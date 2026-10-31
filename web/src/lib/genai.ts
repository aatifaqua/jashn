/**
 * Client for the generative features (ideas, assistant, vendor drafts). With an API base it
 * calls the server; without one it runs in demo mode on pre-generated sample content. Either
 * way every failure (network, timeout, bad status, malformed or unsafe output) falls back to
 * the core's deterministic stand-ins, and every result says where it came from.
 */
import {
  ASSIST_LIMITS,
  assistOffline,
  draftEnquiry,
  ideasOffline,
  type AssistReply,
  type AssistTurn,
  type Draft,
  type Ideas,
  type Plan,
  type Sourced,
  type VendorItem,
} from '@jashn/core';
import { createDemo, type DemoContent } from './demo.ts';
import { isRecord, isSource, readDraft, readIdeas, readReply } from './validate.ts';

/** Turns of history sent with an assistant message: as many as the API accepts. */
export const HISTORY_TURNS = ASSIST_LIMITS.history;
/** Longest assistant message, the same limit the API and the offline assistant apply. */
export const MESSAGE_MAX = ASSIST_LIMITS.message;
/**
 * Generous enough for the server's own model chain deadline plus a slow mobile network, short
 * enough that a stalled request turns into a fallback while the user is still waiting.
 */
const TIMEOUT_MS = 25_000;

type GenAiMode = 'live' | 'demo';

/** The three generative features, each always resolving (never rejecting). */
export interface GenAi {
  readonly mode: GenAiMode;
  ideas(plan: Plan): Promise<Sourced<Ideas>>;
  assist(
    plan: Plan,
    message: string,
    history: readonly AssistTurn[],
  ): Promise<Sourced<AssistReply>>;
  draft(plan: Plan, vendor: VendorItem): Promise<Sourced<Draft>>;
}

/** Options for createGenAi; fetch and the demo data are injectable for tests. */
interface GenAiOptions {
  readonly apiBase: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly demo?: DemoContent;
}

/** Why a call produced no usable body; every reason leads to the same offline fallback. */
type PostFailure = 'timeout' | 'network' | 'status' | 'malformed';

/** A POST's parsed JSON body, or the reason there is none. */
type Posted =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly reason: PostFailure };

type Post = (path: string, body: unknown) => Promise<Posted>;

/** Names a thrown failure: the timeout's abort, a body that is not JSON, or the network. */
function failureOf(error: unknown, signal: AbortSignal): PostFailure {
  if (signal.aborted) return 'timeout';
  return error instanceof SyntaxError ? 'malformed' : 'network';
}

/**
 * POSTs JSON and returns the parsed body or a named failure; it never rejects. An
 * AbortController bounds each call, so a hung connection cannot leave the UI busy forever.
 */
function poster(apiBase: string, fetchImpl: typeof fetch, timeoutMs: number): Post {
  const base = apiBase.replace(/\/+$/, '');
  return async (path, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, reason: 'status' };
      const data: unknown = await response.json();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, reason: failureOf(error, controller.signal) };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * A server answer read and checked by `read`, labelled with the source the server gave it; any
 * failed call, rejected body or missing source falls back to the offline answer.
 */
async function fromServer<T extends object>(
  posted: Promise<Posted>,
  read: (data: unknown) => T | null,
  fallback: () => Sourced<T>,
): Promise<Sourced<T>> {
  const result = await posted;
  if (!result.ok) return fallback();
  const value = read(result.data);
  const source = isRecord(result.data) ? result.data.source : null;
  return value === null || !isSource(source) ? fallback() : { ...value, source };
}

function liveClient(post: Post): GenAi {
  return {
    mode: 'live',
    ideas: (plan) =>
      fromServer(
        post('/api/ideas', { input: plan.input }),
        (data) => readIdeas(data, plan.input.constraints),
        () => offlineIdeas(plan),
      ),
    assist: (plan, message, history) =>
      fromServer(
        post('/api/assist', { input: plan.input, message, history: history.slice(-HISTORY_TURNS) }),
        (data) => readReply(data, plan),
        () => offlineReply(plan, message),
      ),
    draft: (plan, vendor) =>
      fromServer(
        post('/api/draft', { input: plan.input, vendorId: vendor.id }),
        (data) => readDraft(data, plan, vendor.id),
        () => offlineDraft(plan, vendor),
      ),
  };
}

function offlineIdeas(plan: Plan): Sourced<Ideas> {
  return { ...ideasOffline(plan.input, plan.budget), source: 'fallback' };
}

function offlineReply(plan: Plan, message: string): Sourced<AssistReply> {
  return { ...assistOffline(message, plan), source: 'fallback' };
}

function offlineDraft(plan: Plan, vendor: VendorItem): Sourced<Draft> {
  return { ...draftEnquiry(plan, vendor), source: 'fallback' };
}

/**
 * The shipped demo file, loaded on first use as its own chunk: it holds whatever Gemini text
 * has been pre-generated for the samples (it may cover only some samples, drafts and
 * answers), which the plan view should not have to download up front. Anything missing,
 * and everything after a failed load, is served from the offline content instead.
 */
function loadShippedDemo(): Promise<DemoContent> {
  return import('./demo-genai.json').then(
    (module) => createDemo(module.default),
    () => createDemo(null),
  );
}

/** A pre-generated demo answer, labelled as Gemini output, or the offline answer when there is none. */
function fromDemo<T extends object>(found: T | null, fallback: () => Sourced<T>): Sourced<T> {
  return found === null ? fallback() : { ...found, source: 'gemini' };
}

/** Demo entries are real Gemini output generated ahead of time, so they keep that label. */
function demoClient(load: () => Promise<DemoContent>): GenAi {
  let loaded: Promise<DemoContent> | undefined;
  const demo = (): Promise<DemoContent> => (loaded ??= load());
  return {
    mode: 'demo',
    ideas: async (plan) =>
      fromDemo((await demo()).ideas(plan.input, plan.today), () => offlineIdeas(plan)),
    assist: async (plan, message) =>
      fromDemo((await demo()).answer(plan, message), () => offlineReply(plan, message)),
    draft: async (plan, vendor) =>
      fromDemo((await demo()).draft(plan, vendor.id), () => offlineDraft(plan, vendor)),
  };
}

/** Creates the client: live when an API base is given, demo mode otherwise. */
export function createGenAi(options: GenAiOptions): GenAi {
  if (options.apiBase.trim() === '') {
    const { demo } = options;
    return demoClient(demo === undefined ? loadShippedDemo : () => Promise.resolve(demo));
  }
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  return liveClient(poster(options.apiBase, fetchImpl, options.timeoutMs ?? TIMEOUT_MS));
}

let shared: GenAi | undefined;

/** The app's client, configured from VITE_API_BASE at build time and created on first use. */
export function defaultGenAi(): GenAi {
  shared ??= createGenAi({ apiBase: import.meta.env.VITE_API_BASE ?? '' });
  return shared;
}
