/**
 * Gemini client: a model chain with a per-call timeout and a whole-chain deadline, retrying
 * only on rate-limit and server errors. The SDK call is injected so tests need no network.
 */
import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  type Content,
  type FunctionCall,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type Tool,
} from '@google/genai';
import type { CallBudget } from '../middleware/quota.ts';

type Endpoint = 'ideas' | 'assist' | 'draft';

/** Ideas run hot, the assistant cold (it must stay faithful to the plan); caps bound cost. */
export const ENDPOINT_SETTINGS: Readonly<
  Record<Endpoint, { readonly temperature: number; readonly maxOutputTokens: number }>
> = Object.freeze({
  ideas: { temperature: 0.8, maxOutputTokens: 6144 },
  assist: { temperature: 0.3, maxOutputTokens: 2048 },
  draft: { temperature: 0.5, maxOutputTokens: 3072 },
});

// Stated explicitly so the policy does not depend on the API's defaults.
const SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));

interface GenerateRequest {
  readonly endpoint: Endpoint;
  readonly systemInstruction: string;
  readonly contents: string | Content[];
  /** When set, the response is JSON following this schema. */
  readonly responseJsonSchema?: unknown;
  readonly tools?: Tool[];
}

interface Generation {
  readonly text: string;
  readonly functionCalls: readonly FunctionCall[];
  readonly model: string;
}

/** The client the routes depend on, so tests can script it. */
export interface GeminiClient {
  generate(request: GenerateRequest): Promise<Generation>;
}

interface ResponsePart {
  readonly text?: string | undefined;
  readonly thought?: boolean | undefined;
  readonly functionCall?: FunctionCall | undefined;
}

/** The subset of GenerateContentResponse the client reads. */
export interface RawResponse {
  readonly candidates?:
    | readonly {
        readonly content?: { readonly parts?: readonly ResponsePart[] | undefined } | undefined;
        readonly finishReason?: string | undefined;
      }[]
    | undefined;
}

/** The single SDK method used; the real one is `ai.models.generateContent`. */
export type GenerateFn = (params: GenerateContentParameters) => Promise<RawResponse>;

/** Timeouts and backoff of the chain, in milliseconds. */
export interface Timings {
  readonly callTimeoutMs: number;
  readonly deadlineMs: number;
  readonly backoffMs: number;
}

/** A slow model is abandoned after 12 s, the whole chain after 20 s. */
export const DEFAULT_TIMINGS: Timings = Object.freeze({
  callTimeoutMs: 12_000,
  deadlineMs: 20_000,
  backoffMs: 300,
});

/** Chain behaviour: timings, the model order and the shared call budget. */
export interface ChainOptions extends Timings {
  readonly models: readonly string[];
  /** Each model call takes one unit; an empty budget ends the chain. */
  readonly budget: CallBudget;
}

/** Why the chain gave up; every kind gets the same treatment (serve the fallback). */
export class GeminiUnavailableError extends Error {
  override readonly name = 'GeminiUnavailableError';
}

/** The HTTP status of an SDK API error, if the value is one. */
export function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

/** 429 and 5xx: the request was fine, so another model may answer. */
export function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  return status !== undefined && (status === 429 || (status >= 500 && status <= 599));
}

// The SDK also gets the signal, but racing it here enforces the deadline even if a call ignores it.
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new GeminiUnavailableError('timed out'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

function configFor(request: GenerateRequest, signal: AbortSignal): GenerateContentConfig {
  const config: GenerateContentConfig = {
    systemInstruction: request.systemInstruction,
    ...ENDPOINT_SETTINGS[request.endpoint],
    safetySettings: [...SAFETY_SETTINGS],
    // Low thinking keeps latency and cost down; the engine already did the reasoning.
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    abortSignal: signal,
  };
  if (request.responseJsonSchema !== undefined) {
    config.responseMimeType = 'application/json';
    config.responseJsonSchema = request.responseJsonSchema;
  }
  if (request.tools !== undefined) {
    config.tools = request.tools;
    config.toolConfig = { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } };
  }
  return config;
}

/**
 * Reads parts directly (the SDK's `text` getter logs a warning on function calls). A candidate
 * that stopped for any reason but STOP was cut short, so it is refused.
 */
function readResponse(response: RawResponse): Pick<Generation, 'text' | 'functionCalls'> {
  const [candidate] = response.candidates ?? [];
  const reason = candidate?.finishReason;
  if (reason !== undefined && reason !== 'STOP') {
    throw new GeminiUnavailableError(`finish: ${reason}`);
  }
  const parts = candidate?.content?.parts ?? [];
  return {
    text: parts.map((part) => (part.thought === true ? '' : (part.text ?? ''))).join(''),
    functionCalls: parts.flatMap((part) => (part.functionCall ? [part.functionCall] : [])),
  };
}

/**
 * Tries models in order; only a 429 or 5xx moves on. A timeout, a 4xx or a spent budget ends
 * the chain at once, because retrying would not help and the user is waiting.
 */
export function createGeminiClientFrom(generate: GenerateFn, options: ChainOptions): GeminiClient {
  return {
    async generate(request) {
      const deadline = AbortSignal.timeout(options.deadlineMs);
      let lastError: unknown = new GeminiUnavailableError('no models configured');
      for (const [index, model] of options.models.entries()) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, options.backoffMs));
        if (deadline.aborted) break;
        if (!options.budget.take()) throw new GeminiUnavailableError('hourly budget spent');
        const signal = AbortSignal.any([deadline, AbortSignal.timeout(options.callTimeoutMs)]);
        try {
          const params = { model, contents: request.contents, config: configFor(request, signal) };
          const response = await untilAborted(generate(params), signal);
          return { ...readResponse(response), model };
        } catch (error) {
          lastError = error;
          if (!isRetryable(error)) break;
        }
      }
      throw new GeminiUnavailableError('all models failed', { cause: lastError });
    },
  };
}

/** The real SDK call for a key; constructing the client makes no network call. */
export function sdkGenerate(apiKey: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  return (params) => ai.models.generateContent(params);
}
