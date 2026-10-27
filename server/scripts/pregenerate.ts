/**
 * Pre-generates the demo content the web app serves without a server (design section 8):
 * exactly one Gemini request per sample event, returning its ideas, an enquiry draft for every
 * vendor and replies to the suggested assistant prompts (src/ai/batch.ts). Every item is checked
 * by the same schemas and guards as live traffic; an item that fails is left out, and the web app
 * shows its labelled offline fallback for it.
 *
 * The run is resumable: a sample whose stored content is complete and still valid for today's
 * plan is kept without a call, and the file is written after each sample, so a run cut short by
 * a daily quota can simply be repeated. The run makes at most three model calls in total. The
 * file is written through Prettier, so it passes the repository's format check as it is.
 *
 * Usage: GEMINI_API_KEY in the environment or in server/.env, then
 *   npm run pregenerate -w server
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { indiaDay, SAMPLE_IDS } from '@jashn/core';
import { pregenerate, type DemoFile } from '../src/ai/batch.ts';
import { createGeminiClientFrom, sdkGenerate } from '../src/ai/gemini.ts';
import { loadConfig, loadLocalEnv } from '../src/config.ts';

const OUTPUT = resolve(import.meta.dirname, '../../web/src/lib/demo-genai.json');

loadLocalEnv(resolve(import.meta.dirname, '../.env'));
const config = loadConfig(process.env);
if (config.geminiApiKey === undefined) {
  console.error('GEMINI_API_KEY is not set; nothing to pre-generate.');
  process.exit(1);
}

let calls = 0;
/** The live model chain, with time for a long batch answer and three model calls at most. */
const gemini = createGeminiClientFrom(sdkGenerate(config.geminiApiKey), {
  models: config.models,
  callTimeoutMs: 180_000,
  deadlineMs: 240_000,
  backoffMs: 5_000,
  budget: { take: () => (calls += 1) <= SAMPLE_IDS.length },
});

/** The JSON goes through Prettier with the repository's settings. */
async function save(file: DemoFile): Promise<void> {
  const options = (await resolveConfig(OUTPUT)) ?? {};
  writeFileSync(OUTPUT, await format(JSON.stringify(file), { ...options, parser: 'json' }));
}

const previous: unknown = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : undefined;
const file = await pregenerate({
  gemini,
  today: indiaDay(Date.now()),
  previous,
  save,
  log: (line) => {
    console.log(line);
  },
});
await save(file);
console.log(`Wrote ${OUTPUT}.`);
