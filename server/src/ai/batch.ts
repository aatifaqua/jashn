/**
 * The demo batch behind scripts/pregenerate.ts: one Gemini request per sample event returns
 * its ideas, an enquiry draft for every vendor and replies to the suggested prompts. The
 * response schema is composed from the live routes' schemas, and every item is checked by the
 * same functions the routes use, so an item is kept only when the live route would have served
 * it. Anything else is left out, and the web app shows its labelled offline fallback instead.
 */
import {
  buildPlan,
  fromIso,
  getProfile,
  GUARD_LIMITS,
  month,
  sampleEvent,
  SAMPLE_IDS,
  seasonOf,
  SUGGESTED_PROMPTS,
  toIso,
  type AssistReply,
  type Ideas,
  type Plan,
  type SampleId,
} from '@jashn/core';
import { z } from 'zod';
import { checkReply } from '../routes/assist.ts';
import { checkDraft } from '../routes/draft.ts';
import { checkIdeas } from '../routes/ideas.ts';
import type { GeminiClient } from './gemini.ts';
import { batchContent, batchSystem } from './prompts.ts';
import { draftTextSchema, ideasSchema, toResponseSchema } from './schemas.ts';
import { patchSchema, UPDATE_EVENT } from './tools.ts';

/** One sample's demo content, in the shape web/src/lib/demo.ts reads. */
export interface SampleContent {
  ideas?: Ideas;
  /** Enquiry text by vendor id. */
  drafts: Record<string, string>;
  /** Replies by SUGGESTED_PROMPTS entry. */
  answers: Record<string, AssistReply>;
}

/** The demo file, web/src/lib/demo-genai.json. */
export interface DemoFile {
  readonly version: 2;
  /** The ISO day the file was written; ideas are kept only while the season is unchanged. */
  readonly generatedOn: string;
  readonly samples: Partial<Record<SampleId, SampleContent>>;
}

const vendorDraftSchema = draftTextSchema.extend({ vendorId: z.string() });

/** A reply to one suggested prompt; `patch` stands in for an update_event call. */
const answerSchema = z
  .object({
    message: z.enum(SUGGESTED_PROMPTS),
    reply: z.string().max(GUARD_LIMITS.reply),
    patch: patchSchema.optional(),
  })
  .strict();

/** The whole batch: the three live response shapes, defined once in schemas.ts and tools.ts. */
export const batchSchema = z
  .object({
    ideas: ideasSchema,
    drafts: z.array(vendorDraftSchema),
    answers: z.array(answerSchema),
  })
  .strict();

/** JSON Schema for the API, converted once. */
export const BATCH_RESPONSE_SCHEMA = toResponseSchema(batchSchema);

/** The value, or undefined when the check throws (a schema or guard rejection). */
function attempt<T>(check: () => T): T | undefined {
  try {
    return check();
  } catch {
    return undefined;
  }
}

function entries(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** An own property only, so a key such as "constructor" never reaches the prototype. */
function field(value: unknown, key: string): unknown {
  const record = entries(value);
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The sample's plan as of `today`; samples move with today, so every run rebuilds it. */
export function samplePlan(id: SampleId, today: number): Plan {
  const input = sampleEvent(id, today);
  return buildPlan(input, today, getProfile(input.type));
}

/**
 * Checks each item of a batch-shaped value on its own, exactly as the live routes check their
 * responses, and keeps only those that pass: ideas through checkIdeas, each draft of a vendor
 * in the plan through checkDraft, each answer to a suggested prompt through checkReply (so a
 * patch passes validatePatch). The first item for a vendor or a prompt wins.
 */
export function readBatch(raw: unknown, plan: Plan): SampleContent {
  const ideas = attempt(() => checkIdeas(field(raw, 'ideas'), plan));
  const content: SampleContent = {
    drafts: readDrafts(field(raw, 'drafts'), plan),
    answers: readAnswers(field(raw, 'answers'), plan),
  };
  return ideas === undefined ? content : { ideas, ...content };
}

function readDrafts(raw: unknown, plan: Plan): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const item of list(raw)) {
    const parsed = vendorDraftSchema.safeParse(item);
    if (!parsed.success || Object.hasOwn(drafts, parsed.data.vendorId)) continue;
    const { vendorId, text } = parsed.data;
    const vendor = plan.vendors.find((entry) => entry.id === vendorId);
    const draft = vendor && attempt(() => checkDraft({ text }, plan, vendor));
    if (draft !== undefined) drafts[vendorId] = draft.text;
  }
  return drafts;
}

function readAnswers(raw: unknown, plan: Plan): Record<string, AssistReply> {
  const answers: Record<string, AssistReply> = {};
  for (const item of list(raw)) {
    const parsed = answerSchema.safeParse(item);
    if (!parsed.success || Object.hasOwn(answers, parsed.data.message)) continue;
    const { message, reply, patch } = parsed.data;
    const call = patch === undefined ? undefined : { name: UPDATE_EVENT, args: patch };
    const answer = attempt(() => checkReply(reply, call, plan));
    if (answer !== undefined) answers[message] = answer;
  }
  return answers;
}

/** Stored content in the batch shape, so it is re-checked by readBatch like a new response. */
function asBatch(stored: unknown): unknown {
  const drafts = Object.entries(entries(field(stored, 'drafts'))).map(([vendorId, text]) => ({
    vendorId,
    text,
  }));
  const answers = Object.entries(entries(field(stored, 'answers'))).map(([message, answer]) => ({
    message,
    ...(answer as object),
  }));
  return { ideas: field(stored, 'ideas'), drafts, answers };
}

function count(content: SampleContent): number {
  return Object.keys(content.drafts).length + Object.keys(content.answers).length;
}

/**
 * What still holds of a stored sample, and whether it is complete: it has ideas written in the
 * season the sample now falls in, and every stored draft and answer still passes its checks
 * against today's plan (dates move with today, so an old draft can go stale).
 */
export function keepStored(
  stored: unknown,
  plan: Plan,
  sameSeason: boolean,
): { readonly content: SampleContent; readonly complete: boolean } {
  const batch = asBatch(stored);
  const content = readBatch(sameSeason ? batch : { ...(batch as object), ideas: undefined }, plan);
  const before = list(field(batch, 'drafts')).length + list(field(batch, 'answers')).length;
  return { content, complete: content.ideas !== undefined && count(content) === before };
}

/** One Gemini request for one sample, every item checked by readBatch. */
export async function generateSample(gemini: GeminiClient, plan: Plan): Promise<SampleContent> {
  const generation = await gemini.generate({
    endpoint: 'batch',
    systemInstruction: batchSystem(plan),
    contents: batchContent(plan, SUGGESTED_PROMPTS),
    responseJsonSchema: BATCH_RESPONSE_SCHEMA,
  });
  return readBatch(JSON.parse(generation.text), plan);
}

/** The season flags of a sample dated from `day`, as a comparable string. */
function seasonOn(id: SampleId, day: number): string {
  const eventDay = fromIso(sampleEvent(id, day).date) ?? day;
  return JSON.stringify(seasonOf(month(eventDay)));
}

/** What a run needs from the outside: the client, the day, the old file and a save hook. */
export interface PregenerateDeps {
  readonly gemini: GeminiClient;
  readonly today: number;
  /** The previous file's parsed JSON, or undefined when there is none. */
  readonly previous: unknown;
  /** Called after each sample, so an interrupted run keeps what it already paid for. */
  readonly save: (file: DemoFile) => Promise<void>;
  readonly log: (line: string) => void;
}

/**
 * Builds the demo file: a sample whose stored content is complete and still valid is kept
 * without a call; every other sample gets exactly one batch request, merged over whatever of
 * its stored content still holds. A failed request keeps that and moves on, so the run can
 * simply be repeated later.
 */
export async function pregenerate(deps: PregenerateDeps): Promise<DemoFile> {
  const { gemini, today, previous } = deps;
  const oldDay = fromIso(String(field(previous, 'generatedOn')));
  const oldSamples = field(previous, 'version') === 2 ? field(previous, 'samples') : undefined;
  const samples: Partial<Record<SampleId, SampleContent>> = {};
  const file = (): DemoFile => ({ version: 2, generatedOn: toIso(today), samples });
  for (const id of SAMPLE_IDS) {
    const plan = samplePlan(id, today);
    const sameSeason = oldDay !== null && seasonOn(id, oldDay) === seasonOn(id, today);
    const kept = keepStored(field(oldSamples, id), plan, sameSeason);
    if (kept.complete) {
      samples[id] = kept.content;
      deps.log(`${id}: kept`);
      continue;
    }
    try {
      const fresh = await generateSample(gemini, plan);
      samples[id] = {
        ...kept.content,
        ...fresh,
        drafts: { ...kept.content.drafts, ...fresh.drafts },
        answers: { ...kept.content.answers, ...fresh.answers },
      };
      deps.log(`${id}: generated, ${String(count(fresh))} drafts and answers`);
    } catch (error) {
      samples[id] = kept.content;
      deps.log(`${id}: failed (${error instanceof Error ? error.message : String(error)})`);
    }
    await deps.save(file());
  }
  return file();
}
