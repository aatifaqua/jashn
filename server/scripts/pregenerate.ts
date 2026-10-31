/**
 * Pre-generates the serverless demo content through the routes' own live functions, so every
 * item passes their schemas and guards; an item that fails is left out (the web app falls back).
 * Resumable: items already in the file are kept and only missing ones are requested, unless
 * `--refresh` asks for all; a new item replaces an old one only when it succeeds. The run stops
 * on a rejected key (401/403) or after a few failures in a row (a spent quota), writes only if
 * something new succeeded, and exits non-zero when any item failed.
 * Usage: set GEMINI_API_KEY (or server/.env), then `npm run pregenerate -w server [-- --refresh]`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { format, resolveConfig } from 'prettier';
import {
  buildPlan,
  indiaDay,
  sampleEvent,
  SAMPLE_IDS,
  SUGGESTED_PROMPTS,
  toIso,
} from '@jashn/core';
import { getProfile } from '@jashn/core/server';
import {
  createGeminiClientFrom,
  DEFAULT_TIMINGS,
  sdkGenerate,
  statusOf,
} from '../src/ai/gemini.ts';
import { loadConfig, loadLocalEnv } from '../src/config.ts';
import { liveAssist } from '../src/routes/assist.ts';
import { liveDraft } from '../src/routes/draft.ts';
import { liveIdeas } from '../src/routes/ideas.ts';

const OUTPUT = resolve(import.meta.dirname, '../../web/src/lib/demo-genai.json');
/** Failures in a row that end the run: by then the quota is spent, and more calls only fail. */
const MAX_FAILURES_IN_A_ROW = 3;
/** Spaces calls out so a run stays under the per-minute request limit. */
const PAUSE_MS = 2_000;
const refresh = process.argv.includes('--refresh');

loadLocalEnv(resolve(import.meta.dirname, '../.env'));
const config = loadConfig(process.env);
if (config.geminiApiKey === undefined) {
  console.error('GEMINI_API_KEY is not set; nothing to pre-generate.');
  process.exit(1);
}
const gemini = createGeminiClientFrom(sdkGenerate(config.geminiApiKey), {
  ...DEFAULT_TIMINGS,
  models: config.models,
  budget: { take: () => true },
});

type Items = Record<string, unknown>;
interface Sample {
  ideas?: unknown;
  drafts: Items;
  answers: Items;
}

function isItems(value: unknown): value is Items {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Items {
  return isItems(value) ? value : {};
}

const old = record(existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : null);
const samples: Record<string, Sample> = {};

let added = 0;
let failed = 0;
let inARow = 0;
let stopped = false;

/** Calls the model for one missing item; stores it only on success. */
async function fill(
  label: string,
  have: unknown,
  call: () => Promise<unknown>,
  keep: (value: unknown) => void,
): Promise<void> {
  if (stopped || (have !== undefined && !refresh)) return;
  await sleep(PAUSE_MS);
  try {
    keep(await call());
    added += 1;
    inARow = 0;
  } catch (error) {
    failed += 1;
    inARow += 1;
    const status = statusOf(error instanceof Error ? error.cause : undefined) ?? statusOf(error);
    console.log(`${label}: failed (${String(error)})`);
    if (status === 401 || status === 403) {
      console.error('The API key was rejected; stopping.');
      stopped = true;
    } else if (inARow >= MAX_FAILURES_IN_A_ROW) {
      console.error(`${String(inARow)} failures in a row (quota?); stopping.`);
      stopped = true;
    }
  }
}

const today = indiaDay(Date.now());
for (const id of SAMPLE_IDS) {
  const input = sampleEvent(id, today);
  const plan = buildPlan(input, today, getProfile(input.type));
  const entry = record(record(old.samples)[id]);
  const sample: Sample = {
    ...(entry.ideas === undefined ? {} : { ideas: entry.ideas }),
    drafts: { ...record(entry.drafts) },
    answers: { ...record(entry.answers) },
  };
  samples[id] = sample;
  for (const vendor of plan.vendors) {
    await fill(
      `${id} ${vendor.id}`,
      sample.drafts[vendor.id],
      async () => (await liveDraft(gemini, plan, vendor)).text,
      (text) => {
        sample.drafts[vendor.id] = text;
      },
    );
  }
  for (const message of SUGGESTED_PROMPTS) {
    await fill(
      `${id} "${message}"`,
      sample.answers[message],
      () => liveAssist(gemini, plan, { message, history: [] }),
      (answer) => {
        sample.answers[message] = answer;
      },
    );
  }
  await fill(
    `${id} ideas`,
    sample.ideas,
    () => liveIdeas(gemini, plan),
    (ideas) => {
      sample.ideas = ideas;
    },
  );
  console.log(`${id}: done`);
}

if (added > 0) {
  const file = { version: 2, generatedOn: toIso(today), samples };
  const options = (await resolveConfig(OUTPUT)) ?? {};
  writeFileSync(OUTPUT, await format(JSON.stringify(file), { ...options, parser: 'json' }));
  console.log(`Wrote ${String(added)} new item(s) to ${OUTPUT}.`);
} else {
  console.log('Nothing new succeeded; the file is unchanged.');
}
// Every stop follows a failure, so this also covers a run cut short.
if (failed > 0) process.exit(1);
