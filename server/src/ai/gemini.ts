/**
 * Gemini client: a model chain with a per-call timeout and a whole-chain deadline, retries
 * only on rate-limit and server errors, explicit safety settings and per-endpoint generation
 * settings. The SDK call is injected, so every path is tested without the network.
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
  type SafetySetting,
  type Tool,
} from '@google/genai';
import type { CallBudget } from '../middleware/quota.ts';

/** The three generative endpoints, plus the demo batch that does all three at once. */
export type Endpoint = 'ideas' | 'assist' | 'draft' | 'batch';

/**
 * Creative ideas get a high temperature, the assistant a low one (it must stay faithful to the
 * plan), drafts sit between. Output caps bound cost and latency per endpoint, with headroom for
 * the low thinking budget. The offline demo batch holds ideas, every draft and every answer.
 */
export const ENDPOINT_SETTINGS: Readonly<
  Record<Endpoint, { readonly temperature: number; readonly maxOutputTokens: number }>
> = Object.freeze({
  ideas: { temperature: 0.8, maxOutputTokens: 6144 },
  assist: { temperature: 0.3, maxOutputTokens: 2048 },
  draft: { temperature: 0.5, maxOutputTokens: 3072 },
  batch: { temperature: 0.6, maxOutputTokens: 24_576 },
});

/** Stated explicitly so the policy does not depend on the API's defaults. */
export const SAFETY_SETTINGS: readonly SafetySetting[] = Object.freeze(
  [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  ].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE })),
);

/** One generation request. */
export interface GenerateRequest {
  readonly endpoint: Endpoint;
  readonly systemInstruction: string;
  readonly contents: string | Content[];
  /** JSON Schema the response must follow; when set the response is JSON. */
  readonly responseJsonSchema?: unknown;
  readonly tools?: Tool[];
}

/** What a model returned. */
export interface Generation {
  readonly text: string;
  readonly functionCalls: readonly FunctionCall[];
  readonly model: string;
}

/** The client the routes depend on. */
export interface GeminiClient {
  generate(request: GenerateRequest): Promise<Generation>;
}

/** The fields of one response part the client reads. */
interface ResponsePart {
  readonly text?: string | undefined;
  /** Set on thinking parts, which are never shown. */
  readonly thought?: boolean | undefined;
  readonly functionCall?: FunctionCall | undefined;
}

/** The fields of an SDK response the client reads (a subset of GenerateContentResponse). */
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
  /** Pause before trying the next model after a retryable failure. */
  readonly backoffMs: number;
}

/** Production timings: a slow model is abandoned after 12 s, the whole chain after 20 s. */
export const DEFAULT_TIMINGS: Timings = Object.freeze({
  callTimeoutMs: 12_000,
  deadlineMs: 20_000,
  backoffMs: 300,
});

/** Chain behaviour. */
export interface ChainOptions extends Timings {
  readonly models: readonly string[];
  /** Each model call takes one unit; an empty budget ends the chain. */
  readonly budget: CallBudget;
}

/** Why the chain gave up; the routes treat every kind the same way (serve the fallback). */
export class GeminiUnavailableError extends Error {
  override readonly name = 'GeminiUnavailableError';
}

/** The HTTP status of an SDK API error, if the value is one. */
export function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

/** True for 429 and 5xx: the request was fine and another model, or a moment later, may answer. */
export function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  return status !== undefined && (status === 429 || (status >= 500 && status <= 599));
}

/**
 * Settles with the promise, or rejects as soon as the signal aborts, whichever comes first.
 * The SDK also receives the signal, but racing it here guarantees the deadline even if a call
 * ignores it. The signal is always fresh here: the caller checks the deadline just before.
 */
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
 * Text and function calls of the first candidate, read from its parts rather than the SDK's
 * `text` getter, which writes an unstructured console warning whenever a part is a function
 * call. A candidate that stopped for any reason but STOP (MAX_TOKENS, SAFETY, RECITATION) was
 * cut short, so it is refused rather than served as a complete answer.
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

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds a client over any generateContent-shaped function. Models are tried in order; only a
 * 429 or 5xx moves on to the next one. A timeout, a 4xx or a spent budget ends the chain at
 * once, because retrying would not help and the user is waiting.
 */
export function createGeminiClientFrom(generate: GenerateFn, options: ChainOptions): GeminiClient {
  return {
    async generate(request) {
      const deadline = AbortSignal.timeout(options.deadlineMs);
      let lastError: unknown = new GeminiUnavailableError('no models configured');
      for (const [index, model] of options.models.entries()) {
        if (index > 0) await pause(options.backoffMs);
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

/** The real SDK call for a key. Constructing the SDK client makes no network call. */
export function sdkGenerate(apiKey: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  return (params) => ai.models.generateContent(params);
}
