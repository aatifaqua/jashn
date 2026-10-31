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
import { isSource, readDraft, readIdeas, readReply } from './validate.ts';

/** Turns of history sent with an assistant message (design section 7), as the API accepts. */
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

type Post = (path: string, body: unknown) => Promise<unknown>;

/**
 * POSTs JSON and returns the parsed body, or undefined on any failure. An AbortController
 * bounds each call, so a hung connection cannot leave the UI busy forever.
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
      return response.ok ? ((await response.json()) as unknown) : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  };
}

function sourceOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null
    ? (value as { source?: unknown }).source
    : null;
}

function liveClient(post: Post): GenAi {
  return {
    mode: 'live',
    async ideas(plan) {
      const data = await post('/api/ideas', { input: plan.input });
      const ideas = readIdeas(data, plan.input.constraints);
      const source = sourceOf(data);
      if (ideas === null || !isSource(source)) return offlineIdeas(plan);
      return { ...ideas, source };
    },
    async assist(plan, message, history) {
      const turns = history.slice(-HISTORY_TURNS);
      const data = await post('/api/assist', { input: plan.input, message, history: turns });
      const reply = readReply(data, plan);
      const source = sourceOf(data);
      if (reply === null || !isSource(source)) return offlineReply(plan, message);
      return { ...reply, source };
    },
    async draft(plan, vendor) {
      const data = await post('/api/draft', { input: plan.input, vendorId: vendor.id });
      const draft = readDraft(data, plan, vendor.id);
      const source = sourceOf(data);
      if (draft === null || !isSource(source)) return offlineDraft(plan, vendor);
      return { ...draft, source };
    },
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

/** Demo entries are real Gemini output generated ahead of time, so they keep that label. */
function demoClient(load: () => Promise<DemoContent>): GenAi {
  let loaded: Promise<DemoContent> | undefined;
  const demo = (): Promise<DemoContent> => (loaded ??= load());
  return {
    mode: 'demo',
    async ideas(plan) {
      const ideas = (await demo()).ideas(plan.input, plan.today);
      return ideas === null ? offlineIdeas(plan) : { ...ideas, source: 'gemini' };
    },
    async assist(plan, message) {
      const reply = (await demo()).answer(plan, message);
      return reply === null ? offlineReply(plan, message) : { ...reply, source: 'gemini' };
    },
    async draft(plan, vendor) {
      const draft = (await demo()).draft(plan, vendor.id);
      return draft === null ? offlineDraft(plan, vendor) : { ...draft, source: 'gemini' };
    },
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
