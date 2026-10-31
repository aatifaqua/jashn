import { ideasOffline, type Plan } from '@jashn/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import { createDemo } from './demo.ts';
import { HISTORY_TURNS, createGenAi, defaultGenAi } from './genai.ts';

const plan: Plan = planFor(sampleInput('kids-birthday'));
const venue = plan.vendors[0];
if (venue === undefined) throw new Error('fixture has no vendors');

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The JSON text a request carried; the client always sends a string body. */
function bodyOf(init: RequestInit | undefined): string {
  return typeof init?.body === 'string' ? init.body : '';
}

function live(handler: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) =>
    handler(typeof url === 'string' ? url : '', init ?? {}),
  );
  const client = createGenAi({ apiBase: 'https://api.example/', fetch: fetchMock, timeoutMs: 50 });
  return { client, fetchMock };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('live mode', () => {
  it('calls the same origin when the API base is a path', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ reply: 'Ok.', source: 'gemini' })));
    const client = createGenAi({ apiBase: '/', fetch: fetchMock });
    expect(client.mode).toBe('live');
    expect(await client.assist(plan, 'hi', [])).toEqual({ reply: 'Ok.', source: 'gemini' });
    expect(fetchMock.mock.calls[0]).toEqual([
      expect.stringMatching(/^\/api\/assist$/),
      expect.anything(),
    ]);
  });

  it('posts JSON to the API and returns validated, sourced results', async () => {
    const ideas = ideasOffline(plan.input);
    const { client, fetchMock } = live((url) => {
      if (url.endsWith('/api/ideas')) return Promise.resolve(json({ ...ideas, source: 'gemini' }));
      if (url.endsWith('/api/assist')) {
        return Promise.resolve(
          json({ reply: 'Fewer guests.', patch: { invited: 30 }, source: 'gemini' }),
        );
      }
      return Promise.resolve(json({ vendorId: venue.id, text: 'Namaste', source: 'gemini' }));
    });
    expect(client.mode).toBe('live');
    expect(await client.ideas(plan)).toEqual({ ...ideas, source: 'gemini' });
    expect(await client.assist(plan, 'cut guests', [])).toEqual({
      reply: 'Fewer guests.',
      patch: { invited: 30 },
      source: 'gemini',
    });
    expect(await client.draft(plan, venue)).toEqual({
      vendorId: venue.id,
      text: 'Namaste',
      source: 'gemini',
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example/api/ideas');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(JSON.parse(bodyOf(init))).toEqual({ input: plan.input });
  });

  it('sends at most the last six turns of history', async () => {
    const { client, fetchMock } = live(() =>
      Promise.resolve(json({ reply: 'Ok.', source: 'gemini' })),
    );
    const history = Array.from({ length: 9 }, (_, i) => ({
      role: 'user' as const,
      text: String(i),
    }));
    await client.assist(plan, 'hello', history);
    const body = JSON.parse(bodyOf(fetchMock.mock.calls[0]?.[1])) as { history: unknown[] };
    expect(body.history).toHaveLength(HISTORY_TURNS);
  });

  it('falls back on HTTP errors, bad shapes, unsafe output and network failure', async () => {
    const responses = [
      json({ error: 'busy' }, 503),
      json({ reply: 'It costs ₹12,34,567.', source: 'gemini' }),
      json({ vendorId: 'other', text: 'Hi', source: 'gemini' }),
    ];
    const { client } = live(() => {
      const next = responses.shift();
      return next === undefined ? Promise.reject(new TypeError('offline')) : Promise.resolve(next);
    });
    expect((await client.ideas(plan)).source).toBe('fallback');
    expect((await client.assist(plan, 'what is late?', [])).source).toBe('fallback');
    expect((await client.draft(plan, venue)).source).toBe('fallback');
    expect((await client.ideas(plan)).source).toBe('fallback');
  });

  it('falls back when a successful response is not JSON', async () => {
    const { client } = live(() => Promise.resolve(new Response('{not json', { status: 200 })));
    expect((await client.ideas(plan)).source).toBe('fallback');
  });

  it('falls back when the response has no valid source label', async () => {
    const ideas = ideasOffline(plan.input);
    const { client } = live((url) =>
      Promise.resolve(
        url.endsWith('/api/ideas')
          ? json({ ...ideas, source: 'model' })
          : url.endsWith('/api/assist')
            ? json({ reply: 'Ok.' })
            : json({ vendorId: venue.id, text: 'Hi' }),
      ),
    );
    expect((await client.ideas(plan)).source).toBe('fallback');
    expect((await client.assist(plan, 'hi', [])).source).toBe('fallback');
    expect((await client.draft(plan, venue)).source).toBe('fallback');
  });

  it('aborts a request that outlives its timeout and falls back', async () => {
    const { client } = live(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    const result = await client.draft(plan, venue);
    expect(result.source).toBe('fallback');
    expect(result.text).toContain('Hello');
  });
});

describe('demo mode', () => {
  it('serves demo entries as Gemini output and falls back otherwise', async () => {
    const ideas = ideasOffline(plan.input);
    const demo = createDemo({
      version: 2,
      samples: {
        'kids-birthday': {
          ideas,
          drafts: { [venue.id]: 'Demo draft' },
          answers: { 'What is late?': { reply: 'Demo answer.' } },
        },
      },
    });
    const client = createGenAi({ apiBase: '', demo });
    expect(client.mode).toBe('demo');
    expect((await client.ideas(plan)).source).toBe('gemini');
    expect(await client.assist(plan, 'What is late?', [])).toEqual({
      reply: 'Demo answer.',
      source: 'gemini',
    });
    expect((await client.draft(plan, venue)).text).toBe('Demo draft');

    const other = planFor({ ...plan.input, invited: 41 });
    expect((await client.ideas(other)).source).toBe('fallback');
    expect((await client.assist(other, 'What is late?', [])).source).toBe('fallback');
    expect((await client.draft(other, venue)).source).toBe('fallback');
  });

  it('uses the shipped demo file by default', async () => {
    const client = createGenAi({ apiBase: '  ' });
    expect((await client.ideas(plan)).source).toBe('gemini');
    expect(defaultGenAi()).toBe(defaultGenAi());
    expect(defaultGenAi().mode).toBe('demo');
  });

  describe('default transport', () => {
    it('uses the global fetch when none is injected', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(json({ reply: 'Ok.', source: 'gemini' })));
      vi.stubGlobal('fetch', fetchMock);
      const client = createGenAi({ apiBase: 'https://api.example' });
      expect(await client.assist(plan, 'hi', [])).toEqual({ reply: 'Ok.', source: 'gemini' });
      expect(fetchMock).toHaveBeenCalledOnce();
      vi.unstubAllGlobals();
    });
  });
});
