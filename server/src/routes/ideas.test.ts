import { ideasOffline } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import { DISCLAIMER } from './common.ts';
import {
  apiError,
  fakeGenerate,
  GOOD_IDEAS,
  post,
  sample,
  testApp,
  testConfig,
  type Scripted,
} from '../testing.ts';

const ok: Scripted = { text: JSON.stringify(GOOD_IDEAS) };

async function ideas(script: readonly Scripted[], configOverrides = {}) {
  const fake = fakeGenerate(script);
  const { app, logs } = testApp({
    generate: fake.generate,
    config: testConfig(configOverrides),
  });
  const res = await post(app, '/api/ideas', { input: sample() });
  return { res, body: (await res.json()) as Record<string, unknown>, fake, app, logs };
}

describe('POST /api/ideas', () => {
  it('returns validated Gemini ideas with source and disclaimer', async () => {
    const { res, body, fake, logs } = await ideas([ok]);
    expect(res.status).toBe(200);
    expect(body).toEqual({ ...GOOD_IDEAS, source: 'gemini', disclaimer: DISCLAIMER });
    expect(logs[0]?.source).toBe('gemini');
    const config = fake.calls[0]?.config;
    expect(config?.temperature).toBe(0.8);
    expect(config?.responseMimeType).toBe('application/json');
    expect(config?.responseJsonSchema).toMatchObject({ type: 'object' });
    expect(config?.safetySettings).toHaveLength(4);
    expect(JSON.stringify(fake.calls[0]?.contents)).toContain('<<<NOTE');
  });

  it('serves the fallback when Gemini output breaks the schema', async () => {
    const { body } = await ideas([{ text: JSON.stringify({ ...GOOD_IDEAS, decor: [] }) }]);
    expect(body).toMatchObject({ source: 'fallback', disclaimer: DISCLAIMER });
    expect(body.theme).toEqual(ideasOffline(sample()).theme);
  });

  it('serves the fallback when the output is not JSON', async () => {
    const { body } = await ideas([{ text: 'Sure! Here are some ideas' }]);
    expect(body.source).toBe('fallback');
  });

  it('serves the fallback when a guard rejects the menu', async () => {
    const menu = [...GOOD_IDEAS.menu.slice(0, 2), { title: 'Chicken tikka', detail: 'Grilled.' }];
    const { body } = await ideas([{ text: JSON.stringify({ ...GOOD_IDEAS, menu }) }]);
    expect(body.source).toBe('fallback');
  });

  it('falls through the model chain on 503', async () => {
    const { body, fake } = await ideas([apiError(503), ok]);
    expect(body.source).toBe('gemini');
    expect(fake.calls.map((call) => call.model)).toEqual(['model-a', 'model-b']);
  });

  it('serves the fallback when every model is overloaded', async () => {
    const { body, fake } = await ideas([apiError(429)]);
    expect(body.source).toBe('fallback');
    expect(fake.calls).toHaveLength(2);
  });

  it('serves the fallback on a timeout without trying another model', async () => {
    const { body, fake } = await ideas(['hang']);
    expect(body.source).toBe('fallback');
    expect(fake.calls).toHaveLength(1);
  });

  it('serves the fallback once the hourly Gemini budget is spent', async () => {
    const fake = fakeGenerate([ok]);
    const { app } = testApp({ generate: fake.generate, config: testConfig({ hourlyBudget: 1 }) });
    const first = await post(app, '/api/ideas', { input: sample() });
    const other = { input: sample('kids-birthday') };
    const second = await post(app, '/api/ideas', other);
    expect(((await first.json()) as { source: string }).source).toBe('gemini');
    expect(((await second.json()) as { source: string }).source).toBe('fallback');
    expect(fake.calls).toHaveLength(1);
  });

  it('caches Gemini results and coalesces concurrent identical requests', async () => {
    const fake = fakeGenerate([ok]);
    const { app } = testApp({ generate: fake.generate });
    const body = { input: sample() };
    const [a, b] = await Promise.all([
      post(app, '/api/ideas', body),
      post(app, '/api/ideas', body),
    ]);
    const c = await post(app, '/api/ideas', { input: { ...sample(), city: '  Lucknow ' } });
    for (const res of [a, b, c]) {
      expect(((await res.json()) as { source: string }).source).toBe('gemini');
    }
    expect(fake.calls).toHaveLength(1);
  });

  it('never caches a fallback', async () => {
    const fake = fakeGenerate([{ text: 'not json' }, ok]);
    const { app } = testApp({ generate: fake.generate });
    const body = { input: sample() };
    const first = await post(app, '/api/ideas', body);
    const second = await post(app, '/api/ideas', body);
    expect(((await first.json()) as { source: string }).source).toBe('fallback');
    expect(((await second.json()) as { source: string }).source).toBe('gemini');
  });
});
