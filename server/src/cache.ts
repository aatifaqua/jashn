/**
 * LRU cache with a TTL and in-flight coalescing, so identical concurrent requests share one
 * Gemini call. Fallbacks are never stored, so the next request tries Gemini again.
 */
import { createHash } from 'node:crypto';
import { canonicalKey, type EventInput, type Source } from '@jashn/core';

const CACHE_MAX = 256;
const CACHE_TTL_MS = 3_600_000;

interface Entry<V> {
  readonly value: V;
  readonly expires: number;
}

/** What a cached response depends on; cacheKey hashes exactly these parts. */
export interface KeyParts {
  readonly endpoint: 'ideas' | 'draft';
  readonly input: EventInput;
  /** Drafts only: their book-by dates move with today, while ideas hold no dates. */
  readonly today?: number;
  readonly vendorId?: string;
}

/** Hashed so keys stay short and the user's note never sits in memory as a readable key. */
export function cacheKey(parts: KeyParts): string {
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
  run(key: string, produce: () => Promise<V>): Promise<V>;
  readonly size: number;
}

/** An empty cache; `now` is injected so tests can expire entries. */
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
