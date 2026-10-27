import { describe, expect, it, vi } from 'vitest';
import { createApp, usesGemini } from './app.ts';
import { BODY_LIMIT_BYTES } from './middleware/errors.ts';
import { NOW, post, sample, testApp, testConfig } from './testing.ts';

describe('health', () => {
  it('reports fallback mode without a Gemini client and is cacheable', async () => {
    const { app } = testApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', genai: 'fallback' });
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('reports fallback mode when the hourly budget is zero', async () => {
    const { app } = testApp({
      generate: () => Promise.resolve({}),
      config: testConfig({ hourlyBudget: 0 }),
    });
    expect(await (await app.request('/api/health')).json()).toMatchObject({ genai: 'fallback' });
  });

  it('agrees with usesGemini, which the start-up log reads', () => {
    const generate = () => Promise.resolve({});
    expect(usesGemini(testConfig(), generate)).toBe(true);
    expect(usesGemini(testConfig({ hourlyBudget: 0 }), generate)).toBe(false);
    expect(usesGemini(testConfig(), null)).toBe(false);
  });

  it('reports gemini mode with a client', async () => {
    const { app } = testApp({ generate: () => Promise.resolve({}) });
    const res = await app.request('/api/health');
    expect(await res.json()).toEqual({ status: 'ok', genai: 'gemini' });
  });
});

describe('security headers', () => {
  it('sends the API policy on every API response', async () => {
    const { app } = testApp();
    const res = await app.request('/api/health');
    const h = res.headers;
    expect(h.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(h.get('strict-transport-security')).toBe('max-age=63072000; includeSubDomains');
    expect(h.get('x-content-type-options')).toBe('nosniff');
    expect(h.get('referrer-policy')).toBe('no-referrer');
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('permissions-policy')).toContain('camera=()');
    expect(h.get('permissions-policy')).toContain('payment=()');
    expect(h.get('x-request-id')).toMatch(/^[\w-]+$/);
  });

  it('never adopts a client-supplied request id', async () => {
    const { app } = testApp();
    const res = await app.request('/api/nope', { headers: { 'x-request-id': 'chosen-by-client' } });
    expect(res.headers.get('x-request-id')).not.toBe('chosen-by-client');
    expect(await res.text()).not.toContain('chosen-by-client');
  });

  it('allows only listed origins, and only POST', async () => {
    const { app } = testApp();
    const allowed = await app.request('/api/ideas', {
      method: 'OPTIONS',
      headers: { origin: 'https://jashn.example', 'access-control-request-method': 'POST' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://jashn.example');
    expect(allowed.headers.get('access-control-allow-methods')).toBe('POST');
    const other = await app.request('/api/ideas', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('request errors', () => {
  it('rejects a non-JSON body with 415', async () => {
    const { app } = testApp();
    const res = await app.request('/api/ideas', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.error).toBe('unsupported-media-type');
    expect(body.requestId).toBe(res.headers.get('x-request-id'));
  });

  it('rejects a request without a content type with 415', async () => {
    const { app } = testApp();
    const res = await app.request('/api/ideas', { method: 'POST', body: '{}' });
    expect(res.status).toBe(415);
  });

  it('rejects a body over 16 KB with 413', async () => {
    const { app } = testApp();
    const note = 'x'.repeat(BODY_LIMIT_BYTES);
    const res = await post(app, '/api/ideas', { input: { ...sample(), note } });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toBe('payload-too-large');
  });

  it('rejects malformed JSON with 400', async () => {
    const { app } = testApp();
    const res = await app.request('/api/ideas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"input":',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid-json');
  });

  it('rejects unknown keys without echoing them', async () => {
    const { app } = testApp();
    const res = await post(app, '/api/ideas', { input: sample(), '<script>': 1 });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toContain('<script>');
    expect(JSON.parse(text)).toMatchObject({
      error: 'invalid-request',
      fields: [{ field: 'body', code: 'unknown' }],
    });
  });

  it('names input fields directly in structural errors', async () => {
    const { app } = testApp();
    const res = await post(app, '/api/ideas', { input: { ...sample(), budget: 'lots' } });
    expect(await res.json()).toMatchObject({ fields: [{ field: 'budget', code: 'invalid' }] });
  });

  it('returns the core field errors for semantic problems', async () => {
    const { app } = testApp();
    const res = await post(app, '/api/ideas', { input: { ...sample(), date: '2020-01-01' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ fields: [{ field: 'date', code: 'past' }] });
  });

  it('answers unknown routes with a generic 404', async () => {
    const { app } = testApp();
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'not-found' });
  });
});

describe('rate limit', () => {
  it('answers 429 with Retry-After once a client is over the limit', async () => {
    const { app } = testApp({
      config: testConfig({ rateLimit: { max: 2, windowMs: 60_000 } }),
      socketAddress: () => '10.0.0.1',
    });
    const body = { input: sample() };
    expect((await post(app, '/api/ideas', body)).status).toBe(200);
    const second = await post(app, '/api/ideas', body);
    expect(second.headers.get('ratelimit-remaining')).toBe('0');
    const third = await post(app, '/api/ideas', body);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBe('60');
    expect(await third.json()).toMatchObject({ error: 'rate-limited' });
  });

  it('ignores X-Forwarded-For unless trust-proxy is on', async () => {
    const { app } = testApp({
      config: testConfig({ rateLimit: { max: 1, windowMs: 60_000 } }),
      socketAddress: () => '10.0.0.1',
    });
    const body = { input: sample() };
    await post(app, '/api/ideas', body, { 'x-forwarded-for': '1.1.1.1' });
    const spoofed = await post(app, '/api/ideas', body, { 'x-forwarded-for': '2.2.2.2' });
    expect(spoofed.status).toBe(429);
  });
});

describe('logging', () => {
  it('logs route, method, status, latency and source only', async () => {
    const { app, logs } = testApp();
    await post(app, '/api/ideas', { input: sample() });
    expect(logs).toHaveLength(1);
    const [entry] = logs;
    expect(Object.keys(entry ?? {}).sort()).toEqual(['method', 'ms', 'route', 'source', 'status']);
    expect(entry).toMatchObject({
      route: '/api/ideas',
      method: 'POST',
      status: 200,
      source: 'fallback',
    });
    expect(JSON.stringify(logs)).not.toContain('Kanpur');
  });

  it('logs a null source when nothing was generated', async () => {
    const { app, logs } = testApp();
    await app.request('/api/health');
    expect(logs[0]?.source).toBeNull();
  });
});

describe('dates', () => {
  it('uses the date in India, not the host zone', async () => {
    // 23:00 UTC on 26 Oct is already 27 Oct in India, so an event dated 27 Oct is not past.
    const late = Date.UTC(2026, 9, 26, 23, 0);
    const { app } = testApp({ now: () => late });
    const res = await post(app, '/api/ideas', {
      input: { ...sample('kids-birthday'), date: '2026-10-27' },
    });
    expect(res.status).toBe(200);
    expect(late).toBeLessThan(NOW);
  });
});

describe('defaults', () => {
  it('uses the real clock and writes one JSON log line to stdout', async () => {
    const lines: unknown[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(line);
    });
    try {
      const app = createApp({ config: testConfig(), generate: null });
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);
    } finally {
      spy.mockRestore();
    }
    expect(lines).toHaveLength(1);
    expect(JSON.parse(String(lines[0]))).toMatchObject({ route: '/api/health', status: 200 });
  });

  it('answers 415 when the body has no content type at all', async () => {
    const { app } = testApp();
    const res = await app.request('/api/ideas', {
      method: 'POST',
      body: new TextEncoder().encode('{}'),
    });
    expect(res.status).toBe(415);
  });
});
