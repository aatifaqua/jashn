/**
 * Response cache for generated ideas and drafts: LRU with a TTL, plus in-flight coalescing so
 * concurrent identical requests share one Gemini call. Only Gemini results are stored; a
 * fallback is served but never cached, so the next request tries Gemini again.
 */
import { createHash } from 'node:crypto';
import { canonicalKey, type EventInput, type Source } from '@jashn/core';

/** Entries kept per cache. */
export const CACHE_MAX = 256;
/** How long a generated result is reused. */
export const CACHE_TTL_MS = 3_600_000;

interface Entry<V> {
  readonly value: V;
  readonly expires: number;
}

/** What makes two generated results interchangeable. */
export interface KeyParts {
  readonly endpoint: 'ideas' | 'draft';
  readonly input: EventInput;
  /**
   * Set for drafts, which state book-by dates that move with today. Ideas leave it out: they
   * hold no dates, so a cached set stays valid across midnight.
   */
  readonly today?: number;
  readonly vendorId?: string;
}

/**
 * SHA-256 of the canonical input plus everything else the output depends on. Hashing keeps
 * keys short and uniform, and the user's note never sits in memory as a readable map key.
 */
export function cacheKey(parts: KeyParts): string {
  // canonicalKey covers every input field, the output language included.
  const material = [
    parts.endpoint,
    canonicalKey(parts.input),
    String(parts.today ?? ''),
    parts.vendorId ?? '',
  ].join('\n');
  return createHash('sha256').update(material).digest('hex');
}

/** A cache of sourced results. */
export interface ResponseCache<V extends { readonly source: Source }> {
  /**
   * Returns the cached value, or joins an identical request already in flight, or runs
   * `produce`. The result is stored only when it came from Gemini.
   */
  run(key: string, produce: () => Promise<V>): Promise<V>;
  readonly size: number;
}

/** Creates an empty cache; `now` is injected so tests can expire entries. */
export function createCache<V extends { readonly source: Source }>(
  now: () => number,
  max = CACHE_MAX,
  ttlMs = CACHE_TTL_MS,
): ResponseCache<V> {
  const entries = new Map<string, Entry<V>>();
  const inFlight = new Map<string, Promise<V>>();

  const read = (key: string): V | undefined => {
    const entry = entries.get(key);
    if (entry === undefined) return undefined;
    entries.delete(key);
    if (entry.expires <= now()) return undefined;
    entries.set(key, entry); // re-insert: Map order is the recency order
    return entry.value;
  };

  const store = (key: string, value: V): void => {
    entries.set(key, { value, expires: now() + ttlMs });
    const oldest = entries.keys().next();
    if (entries.size > max && oldest.done !== true) entries.delete(oldest.value);
  };

  return {
    get size() {
      return entries.size;
    },
    run(key, produce) {
      const hit = read(key);
      if (hit !== undefined) return Promise.resolve(hit);
      const pending = inFlight.get(key);
      if (pending !== undefined) return pending;
      const started = produce()
        .then((value) => {
          if (value.source === 'gemini') store(key, value);
          return value;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, started);
      return started;
    },
  };
}
