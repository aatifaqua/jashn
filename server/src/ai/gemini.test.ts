import { describe, expect, it } from 'vitest';
import { hourlyBudget } from '../middleware/quota.ts';
import { apiError, fakeGenerate, type Scripted } from '../testing.ts';
import {
  createGeminiClientFrom,
  ENDPOINT_SETTINGS,
  GeminiUnavailableError,
  isRetryable,
  sdkGenerate,
  type ChainOptions,
} from './gemini.ts';

const options = (overrides: Partial<ChainOptions> = {}): ChainOptions => ({
  models: ['m1', 'm2', 'm3'],
  callTimeoutMs: 50,
  deadlineMs: 500,
  backoffMs: 0,
  budget: hourlyBudget(100, () => 0),
  ...overrides,
});

const request = { endpoint: 'draft', systemInstruction: 'sys', contents: 'hi' } as const;

function client(script: readonly Scripted[], overrides: Partial<ChainOptions> = {}) {
  const fake = fakeGenerate(script);
  return { gemini: createGeminiClientFrom(fake.generate, options(overrides)), calls: fake.calls };
}

describe('createGeminiClientFrom', () => {
  it('returns text, function calls and the model that answered', async () => {
    const { gemini, calls } = client([{ text: 'ok', functionCalls: [{ name: 'f' }] }]);
    const result = await gemini.generate(request);
    expect(result).toEqual({ text: 'ok', functionCalls: [{ name: 'f' }], model: 'm1' });
    const config = calls[0]?.config;
    expect(config).toMatchObject({
      systemInstruction: 'sys',
      ...ENDPOINT_SETTINGS.draft,
      thinkingConfig: { thinkingLevel: 'LOW' },
    });
    expect(config?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(config?.responseMimeType).toBeUndefined();
    expect(config?.tools).toBeUndefined();
  });

  it('defaults missing text and calls to empty values', async () => {
    const { gemini } = client([{}]);
    expect(await gemini.generate(request)).toEqual({ text: '', functionCalls: [], model: 'm1' });
  });

  it('sets JSON output and tool config only when asked', async () => {
    const { gemini, calls } = client([{ text: '{}' }]);
    await gemini.generate({
      ...request,
      responseJsonSchema: { type: 'object' },
      tools: [{ functionDeclarations: [] }],
    });
    expect(calls[0]?.config).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    });
  });

  it('moves down the chain on 429 and 5xx only', async () => {
    const { gemini, calls } = client([apiError(429), apiError(500), { text: 'third' }]);
    expect((await gemini.generate(request)).model).toBe('m3');
    expect(calls.map((call) => call.model)).toEqual(['m1', 'm2', 'm3']);
  });

  it('stops at once on a client error', async () => {
    const { gemini, calls } = client([apiError(400), { text: 'never' }]);
    await expect(gemini.generate(request)).rejects.toBeInstanceOf(GeminiUnavailableError);
    expect(calls).toHaveLength(1);
  });

  it('stops after the last model', async () => {
    const { gemini, calls } = client([apiError(503)]);
    await expect(gemini.generate(request)).rejects.toThrow('all models failed');
    expect(calls).toHaveLength(3);
  });

  it('abandons a call that exceeds the per-call timeout', async () => {
    const { gemini } = client(['hang'], { callTimeoutMs: 10 });
    await expect(gemini.generate(request)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });

  it('stops trying models once the chain deadline has passed', async () => {
    const { gemini, calls } = client([apiError(503)], { deadlineMs: 20, backoffMs: 30 });
    await expect(gemini.generate(request)).rejects.toBeInstanceOf(GeminiUnavailableError);
    expect(calls).toHaveLength(1);
  });

  it('rejects when the chain deadline fires during a call', async () => {
    const { gemini } = client(['hang'], { deadlineMs: 10, callTimeoutMs: 1000 });
    await expect(gemini.generate(request)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });

  it('spends one budget unit per call and stops when the budget is empty', async () => {
    const budget = hourlyBudget(1, () => 0);
    const { gemini, calls } = client([apiError(503), { text: 'ok' }], { budget });
    await expect(gemini.generate(request)).rejects.toThrow('hourly budget spent');
    expect(calls).toHaveLength(1);
  });

  it('fails cleanly with no models configured', async () => {
    const { gemini } = client([{ text: 'x' }], { models: [] });
    await expect(gemini.generate(request)).rejects.toThrow('all models failed');
  });
});

describe('isRetryable', () => {
  it('accepts 429 and 5xx statuses only', () => {
    expect(isRetryable(apiError(429))).toBe(true);
    expect(isRetryable(apiError(503))).toBe(true);
    expect(isRetryable(apiError(599))).toBe(true);
    expect(isRetryable(apiError(404))).toBe(false);
    expect(isRetryable(apiError(600))).toBe(false);
    expect(isRetryable(new Error('boom'))).toBe(false);
    expect(isRetryable({ status: '503' })).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });
});

describe('sdkGenerate', () => {
  it('builds the SDK call without touching the network', () => {
    expect(typeof sdkGenerate('test-key')).toBe('function');
  });
});
