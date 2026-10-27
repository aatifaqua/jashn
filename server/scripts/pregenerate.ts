/**
 * Pre-generates the demo content the web app serves without a server (design section 8): for
 * each sample and each language, ideas, an enquiry draft per vendor and answers to the
 * suggested assistant prompts. It drives the real routes through app.request(), so the output
 * passed the same schemas and guards as live traffic. Only Gemini results are written; the web
 * app uses the core fallbacks for anything missing, and its own guards drop any entry whose
 * dates or figures no longer match the plan on the day it is read.
 *
 * The run is resumable and ordered by value: entries already in the file are kept while they
 * still hold (ideas while the sample's season is the one they were written for and they still
 * pass the schema and the diet guard; drafts and answers while they pass the guards for
 * today's plan), ideas come first, then English answers and drafts, then Hindi ones. A run cut
 * short by a daily quota can simply be repeated later to fill the gaps. The file is written
 * through Prettier, so it passes the repository's format check as it is.
 *
 * Usage: GEMINI_API_KEY in the environment or in server/.env, then
 *   npm run pregenerate -w server
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { format, resolveConfig } from 'prettier';
import {
  buildPlan,
  fromIso,
  getProfile,
  guardDraft,
  guardIdeas,
  guardReply,
  indiaDay,
  month,
  seasonOf,
  sampleEvent,
  SAMPLE_IDS,
  SUGGESTED_PROMPTS,
  toIso,
  type AssistReply,
  type Draft,
  type EventInput,
  type Ideas,
  type Language,
  type Plan,
  type SampleId,
  type Sourced,
} from '@jashn/core';
import { sdkGenerate, type GenerateFn } from '../src/ai/gemini.ts';
import { ideasSchema } from '../src/ai/schemas.ts';
import { createApp } from '../src/app.ts';
import { loadConfig, loadLocalEnv } from '../src/config.ts';

const OUTPUT = resolve(import.meta.dirname, '../../web/src/lib/demo-genai.json');
/** A pause between calls keeps the run inside free-tier per-minute request limits. */
const PAUSE_MS = 4_000;
/** A guard can reject one sampled answer and accept the next, so each call gets a few tries. */
const ATTEMPTS = 3;
const LANGUAGE_ORDER = ['en', 'hi'] as const satisfies readonly Language[];

/** A route's response: the generated content plus its source and the disclaimer. */
type RouteResult<T> = Sourced<T> & { readonly disclaimer: string };

/** One sample's demo content in one language, in the shape web/src/lib/demo.ts reads. */
interface LanguageContent {
  ideas?: Ideas;
  drafts: Record<string, string>;
  answers: Record<string, AssistReply>;
}

type Samples = Record<SampleId, Record<Language, LanguageContent>>;

loadLocalEnv(resolve(import.meta.dirname, '../.env'));
const config = loadConfig(process.env);
if (config.geminiApiKey === undefined) {
  console.error('GEMINI_API_KEY is not set; nothing to pre-generate.');
  process.exit(1);
}
const sdk = sdkGenerate(config.geminiApiKey);

/** The SDK call with one line per attempt, so a skipped result can be told apart from an outage. */
const generate: GenerateFn = async (params) => {
  try {
    const response = await sdk(params);
    console.log(`  ${params.model}: ok`);
    return response;
  } catch (error) {
    const { status } = error as { status?: unknown };
    console.warn(
      `  ${params.model}: failed (${typeof status === 'number' ? String(status) : 'no status'})`,
    );
    throw error;
  }
};

const app = createApp({
  config: { ...config, rateLimit: { max: 10_000, windowMs: 60_000 }, hourlyBudget: 10_000 },
  generate,
  log: () => undefined,
  timings: { callTimeoutMs: 60_000, deadlineMs: 180_000, backoffMs: 5_000 },
});
const today = indiaDay(Date.now());

/**
 * POSTs to a route and returns the result only when Gemini produced it. Anything else (a
 * fallback or an error status) is retried, then skipped, so one bad call never loses the run.
 */
async function generated<T>(path: string, body: unknown): Promise<T | null> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    await sleep(PAUSE_MS * attempt);
    const res = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = res.ok ? ((await res.json()) as RouteResult<T>) : null;
    if (result?.source === 'gemini') return result;
    console.warn(`${path}: ${result === null ? `status ${String(res.status)}` : 'fallback'}`);
  }
  return null;
}

/** Drops the response envelope fields so only the generated content is stored. */
function strip<T extends object>(value: T): T {
  const entries = Object.entries(value).filter(
    ([key]) => key !== 'source' && key !== 'disclaimer' && key !== 'vendorId',
  );
  return Object.fromEntries(entries) as T;
}

function inputOf(id: SampleId, language: Language): EventInput {
  return { ...sampleEvent(id, today), language };
}

function planOf(id: SampleId, language: Language): Plan {
  const input = inputOf(id, language);
  return buildPlan(input, today, getProfile(input.type));
}

function empty(): LanguageContent {
  return { drafts: {}, answers: {} };
}

/** The season a sample falls in when it is dated from `day`; ideas are written for it. */
function seasonOn(id: SampleId, day: number): string {
  const eventDay = fromIso(sampleEvent(id, day).date) ?? day;
  return JSON.stringify(seasonOf(month(eventDay)));
}

/**
 * Ideas from the old file still hold when the sample now falls in the same season as when they
 * were written (samples move with today), and they still pass the schema and the diet guard
 * for the sample's needs, which may have changed since.
 */
function ideasHold(ideas: unknown, plan: Plan, id: SampleId, oldToday: number | null): boolean {
  if (oldToday === null || seasonOn(id, oldToday) !== seasonOn(id, today)) return false;
  const parsed = ideasSchema.safeParse(ideas);
  return parsed.success && guardIdeas(parsed.data, plan.input.constraints).length === 0;
}

/** Copies the entries of one sample and language that still hold for today's plan. */
function keep(from: Partial<LanguageContent>, into: LanguageContent, plan: Plan): void {
  for (const [vendorId, text] of Object.entries(from.drafts ?? {})) {
    if (guardDraft(text, plan).length === 0) into.drafts[vendorId] = text;
  }
  for (const [message, answer] of Object.entries(from.answers ?? {})) {
    if (guardReply(answer.reply, plan, answer.patch).length === 0) into.answers[message] = answer;
  }
}

/**
 * The previous file's entries that are still worth keeping: ideas for the same season that
 * still pass their checks, and drafts and answers that still pass the guards against today's
 * plan.
 */
function previous(): Samples {
  const kept = Object.fromEntries(
    SAMPLE_IDS.map((id) => [id, { en: empty(), hi: empty() }]),
  ) as Samples;
  if (!existsSync(OUTPUT)) return kept;
  const old = JSON.parse(readFileSync(OUTPUT, 'utf8')) as {
    generatedOn?: string;
    samples?: Partial<Record<SampleId, Partial<Record<Language, Partial<LanguageContent>>>>>;
  };
  const oldToday = fromIso(old.generatedOn ?? '');
  for (const id of SAMPLE_IDS) {
    for (const language of LANGUAGE_ORDER) {
      const from = old.samples?.[id]?.[language];
      if (from === undefined) continue;
      const plan = planOf(id, language);
      const { ideas, ...rest } = from;
      const into = kept[id][language];
      keep(rest, into, plan);
      if (ideas !== undefined && ideasHold(ideas, plan, id, oldToday)) into.ideas = ideas;
    }
  }
  return kept;
}

const samples = previous();

/**
 * Writes after every result, so an interrupted run keeps what it already paid for. The JSON
 * goes through Prettier with the repository's settings, so the format check passes on it.
 */
async function save(): Promise<void> {
  const file = { version: 1, generatedOn: toIso(today), samples };
  const options = (await resolveConfig(OUTPUT)) ?? {};
  writeFileSync(OUTPUT, await format(JSON.stringify(file), { ...options, parser: 'json' }));
}

async function fillIdeas(id: SampleId, language: Language): Promise<void> {
  const into = samples[id][language];
  if (into.ideas !== undefined) return;
  const ideas = await generated<Ideas>('/api/ideas', { input: inputOf(id, language) });
  if (ideas !== null) into.ideas = strip(ideas);
  await save();
}

async function fillAnswers(id: SampleId, language: Language): Promise<void> {
  const into = samples[id][language];
  const input = inputOf(id, language);
  for (const message of SUGGESTED_PROMPTS) {
    if (Object.hasOwn(into.answers, message)) continue;
    const answer = await generated<AssistReply>('/api/assist', { input, message, history: [] });
    if (answer !== null) into.answers[message] = strip(answer);
    await save();
  }
}

async function fillDrafts(id: SampleId, language: Language): Promise<void> {
  const into = samples[id][language];
  const input = inputOf(id, language);
  for (const vendor of planOf(id, language).vendors) {
    if (Object.hasOwn(into.drafts, vendor.id)) continue;
    const draft = await generated<Draft>('/api/draft', { input, vendorId: vendor.id });
    if (draft !== null) into.drafts[vendor.id] = draft.text;
    await save();
  }
}

for (const language of LANGUAGE_ORDER) {
  for (const id of SAMPLE_IDS) await fillIdeas(id, language);
}
for (const language of LANGUAGE_ORDER) {
  for (const id of SAMPLE_IDS) await fillAnswers(id, language);
  for (const id of SAMPLE_IDS) await fillDrafts(id, language);
}
await save();
console.log(`Wrote ${OUTPUT}.`);
