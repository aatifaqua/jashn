/**
 * Demo-mode content: pre-generated Gemini output for the three sample events, served when no
 * API is configured (the static deployment). An entry is used only when the current input is
 * exactly a sample's input, because generated text describes that event and no other; anything
 * else gets the core's offline fallbacks.
 *
 * File shape (demo-genai.json, written by `npm run pregenerate -w server`):
 * `{ version: 1, generatedOn, samples: { <SampleId>: { en|hi: { ideas?, drafts?: { <vendorId>:
 * text }, answers?: { <SUGGESTED_PROMPTS entry>: { reply, patch? } } } } } }`. Every entry is
 * checked by the same readers and guards as live responses. Sample dates move with today, so
 * the date and amount guards drop a draft or answer whose dates no longer match the plan, and
 * ideas never carry a date; a stale or hand-edited file degrades to the fallback instead of
 * showing something wrong.
 */
import {
  SAMPLE_IDS,
  canonicalKey,
  sampleEvent,
  type AssistReply,
  type Draft,
  type EventInput,
  type Ideas,
  type Plan,
  type SampleId,
} from '@jashn/core';
import { isRecord, readDraft, readIdeas, readReply } from './validate.ts';

/** Lookups into one demo data set. */
export interface DemoContent {
  ideas(input: EventInput, today: number): Ideas | null;
  draft(plan: Plan, vendorId: string): Draft | null;
  answer(plan: Plan, message: string): AssistReply | null;
}

/** The input with the language set aside, so one sample matches in both languages. */
function sampleKey(input: EventInput): string {
  return canonicalKey({ ...input, language: 'en' });
}

/** The sample this input is identical to (ignoring language), or null. */
export function matchSample(input: EventInput, today: number): SampleId | null {
  const key = sampleKey(input);
  return SAMPLE_IDS.find((id) => sampleKey(sampleEvent(id, today)) === key) ?? null;
}

/** Own properties only, so a message such as "constructor" never reaches the prototype. */
function child(value: unknown, key: string): unknown {
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}

/** Builds lookups over untrusted demo data; every value is validated when it is read. */
export function createDemo(data: unknown): DemoContent {
  const entry = (input: EventInput, today: number): unknown => {
    if (child(data, 'version') !== 1) return undefined;
    const id = matchSample(input, today);
    return id === null ? undefined : child(child(child(data, 'samples'), id), input.language);
  };
  return {
    ideas(input, today) {
      return readIdeas(child(entry(input, today), 'ideas'), input.constraints);
    },
    draft(plan, vendorId) {
      const text = child(child(entry(plan.input, plan.today), 'drafts'), vendorId);
      return readDraft({ vendorId, text }, plan, vendorId);
    },
    answer(plan, message) {
      const answers = child(entry(plan.input, plan.today), 'answers');
      return readReply(child(answers, message.trim()), plan);
    },
  };
}
