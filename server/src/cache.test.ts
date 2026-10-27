import { describe, expect, it } from 'vitest';
import { cacheKey, createCache } from './cache.ts';
import { sample, TODAY } from './testing.ts';

interface Value {
  readonly n: number;
  readonly source: 'gemini' | 'fallback';
}

const gemini = (n: number): Value => ({ n, source: 'gemini' });

describe('createCache', () => {
  it('returns a stored Gemini result until it expires', async () => {
    let now = 0;
    const cache = createCache<Value>(() => now, 4, 1000);
    let runs = 0;
    const produce = () => Promise.resolve(gemini((runs += 1)));
    expect((await cache.run('k', produce)).n).toBe(1);
    now = 999;
    expect((await cache.run('k', produce)).n).toBe(1);
    now = 1000;
    expect((await cache.run('k', produce)).n).toBe(2);
  });

  it('never stores a fallback', async () => {
    const cache = createCache<Value>(() => 0);
    await cache.run('k', () => Promise.resolve({ n: 1, source: 'fallback' }));
    expect(cache.size).toBe(0);
  });

  it('evicts the least recently used entry', async () => {
    const cache = createCache<Value>(() => 0, 2, 1000);
    await cache.run('a', () => Promise.resolve(gemini(1)));
    await cache.run('b', () => Promise.resolve(gemini(2)));
    await cache.run('a', () => Promise.resolve(gemini(99))); // touch a
    await cache.run('c', () => Promise.resolve(gemini(3)));
    expect(cache.size).toBe(2);
    expect((await cache.run('a', () => Promise.resolve(gemini(98)))).n).toBe(1);
    expect((await cache.run('b', () => Promise.resolve(gemini(4)))).n).toBe(4);
  });

  it('coalesces concurrent identical requests into one call', async () => {
    const cache = createCache<Value>(() => 0);
    let runs = 0;
    let release: (value: Value) => void = () => undefined;
    const produce = () => {
      runs += 1;
      return new Promise<Value>((resolve) => {
        release = resolve;
      });
    };
    const first = cache.run('k', produce);
    const second = cache.run('k', produce);
    release(gemini(7));
    expect(await Promise.all([first, second])).toEqual([gemini(7), gemini(7)]);
    expect(runs).toBe(1);
  });

  it('lets a later request retry after a failure', async () => {
    const cache = createCache<Value>(() => 0);
    await expect(cache.run('k', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect((await cache.run('k', () => Promise.resolve(gemini(2)))).n).toBe(2);
  });
});

describe('cacheKey', () => {
  const input = sample();
  const base = { endpoint: 'ideas', input, today: TODAY } as const;

  it('is a SHA-256 hex digest that ignores formatting differences', () => {
    const key = cacheKey(base);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(cacheKey({ ...base, input: { ...input, city: ` ${input.city} ` } })).toBe(key);
  });

  it('changes with endpoint, input, day and vendor', () => {
    const key = cacheKey(base);
    expect(cacheKey({ ...base, endpoint: 'draft' })).not.toBe(key);
    expect(cacheKey({ ...base, input: { ...input, invited: input.invited + 1 } })).not.toBe(key);
    expect(cacheKey({ ...base, today: TODAY + 1 })).not.toBe(key);
    expect(cacheKey({ ...base, vendorId: 'venue' })).not.toBe(key);
  });

  it('leaves the day out for ideas, which hold no dates', () => {
    const ideas = cacheKey({ endpoint: 'ideas', input });
    expect(ideas).not.toBe(cacheKey(base));
    expect(cacheKey({ endpoint: 'ideas', input })).toBe(ideas);
  });
});
