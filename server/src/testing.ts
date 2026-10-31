/** Test support: a fixed clock, a config, a scripted fake SDK call and request helpers. */
import type { FunctionCall, GenerateContentParameters } from '@google/genai';
import { indiaDay, sampleEvent, type EventInput, type Ideas, type SampleId } from '@jashn/core';
import type { Hono } from 'hono';
import type { GenerateFn, RawResponse } from './ai/gemini.ts';
import { createApp, type AppDeps } from './app.ts';
import type { Config } from './config.ts';
import type { AppEnv } from './env.ts';
import type { LogEntry } from './middleware/logger.ts';

/** 27 Oct 2026, 11:30 in India. */
export const NOW = Date.UTC(2026, 9, 27, 6, 0);
/** The core day number of NOW in India. */
export const TODAY = indiaDay(NOW);

/** A config with generous limits; tests override what they exercise. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    geminiApiKey: 'test-key',
    port: 8787,
    corsOrigins: ['https://jashn.example'],
    trustProxy: false,
    models: ['model-a', 'model-b'],
    rateLimit: { max: 100, windowMs: 60_000 },
    hourlyBudget: 100,
    clientHourlyBudget: 100,
    staticDir: undefined,
    ...overrides,
  };
}

interface ScriptedReply {
  readonly text?: string;
  readonly functionCalls?: FunctionCall[];
  readonly finishReason?: string;
  readonly thought?: string;
}

/** One scripted SDK outcome: a response, an error to throw, or a call that never settles. */
export type Scripted = ScriptedReply | Error | 'hang';

function toResponse(reply: ScriptedReply): RawResponse {
  const parts = [
    ...(reply.thought === undefined ? [] : [{ text: reply.thought, thought: true }]),
    ...(reply.text === undefined ? [] : [{ text: reply.text }]),
    ...(reply.functionCalls ?? []).map((functionCall) => ({ functionCall })),
  ];
  return { candidates: [{ content: { parts }, finishReason: reply.finishReason ?? 'STOP' }] };
}

/** An error shaped like the SDK's ApiError. */
export function apiError(status: number): Error {
  return Object.assign(new Error(`status ${String(status)}`), { status });
}

/** Plays the script in order (the last entry repeats) and records calls. */
export function fakeGenerate(script: readonly Scripted[]): {
  readonly generate: GenerateFn;
  readonly calls: GenerateContentParameters[];
} {
  const calls: GenerateContentParameters[] = [];
  const generate: GenerateFn = (params) => {
    calls.push(params);
    const next = script[Math.min(calls.length - 1, script.length - 1)];
    if (next === 'hang') return new Promise(() => undefined);
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(toResponse(next ?? {}));
  };
  return { generate, calls };
}

/** An app with a fake clock, captured logs and short timings. */
export function testApp(overrides: Partial<AppDeps> = {}): {
  readonly app: Hono<AppEnv>;
  readonly logs: LogEntry[];
} {
  const logs: LogEntry[] = [];
  const app = createApp({
    config: testConfig(),
    generate: null,
    now: () => NOW,
    log: (entry) => logs.push(entry),
    timings: { callTimeoutMs: 50, deadlineMs: 200, backoffMs: 0 },
    ...overrides,
  });
  return { app, logs };
}

/** POSTs JSON to the app. */
export function post(
  app: Hono<AppEnv>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
}

/** A sample input dated relative to TODAY. */
export function sample(id: SampleId = 'lucknow-wedding'): EventInput {
  return sampleEvent(id, TODAY);
}

/** Valid ideas for the vegetarian, step-free wedding sample. */
export const GOOD_IDEAS: Ideas = {
  theme: {
    name: 'Marigold Evenings',
    palette: ['marigold', 'ivory', 'rose'],
    why: 'Warm colours glow under evening lights and suit a traditional celebration.',
  },
  decor: [
    { title: 'Marigold arches', detail: 'Frame the entrance with fresh marigold strings.' },
    { title: 'Lantern pathways', detail: 'Line level paths with lanterns for easy, safe walking.' },
    { title: 'Floral rangoli', detail: 'A petal rangoli near the stage for photographs.' },
  ],
  menu: [
    { title: 'Paneer tikka', detail: 'Smoky cottage cheese skewers.' },
    { title: 'Dal makhani', detail: 'Slow-cooked black lentils.' },
    { title: 'Kesar kulfi', detail: 'Saffron kulfi to finish.' },
  ],
  activities: [
    { title: 'Family antakshari', detail: 'A song game across generations.' },
    { title: 'Blessing wall', detail: 'Guests write wishes on cards.' },
    { title: 'Dance hour', detail: 'An open floor after dinner.' },
  ],
  touch: { title: 'Seats for elders', detail: 'Cushioned seats near the stage with easy access.' },
  invitation: 'With joy we invite you to celebrate with our families.',
};
