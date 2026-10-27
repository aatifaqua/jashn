/**
 * Per-client fixed-window rate limit for the generative routes. Clients are keyed by socket
 * address (IPv6 by its /64 network); X-Forwarded-For is read only when the operator switches
 * trust-proxy on, because anyone can send that header and would otherwise pick a fresh
 * identity per request.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.ts';
import { problem } from './errors.ts';

/** Finds the socket address of a request; undefined when the runtime cannot tell. */
export type SocketAddress = (c: Context<AppEnv>) => string | undefined;

/** Settings for one limiter. */
export interface RateLimitOptions {
  readonly max: number;
  readonly windowMs: number;
  readonly now: () => number;
  readonly keyOf: (c: Context<AppEnv>) => string;
  /** Upper bound on tracked clients, so a flood of addresses cannot grow memory without limit. */
  readonly maxEntries?: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
/** Expired windows are swept once per this many requests, keeping each request O(1) amortised. */
const SWEEP_EVERY = 256;

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/**
 * The rate-limit identity of an address. An IPv6 host usually controls a whole /64, so it is
 * keyed by that network; otherwise it could rotate addresses to get a fresh window each time.
 */
export function addressKey(address: string): string {
  const plain = address.replace(/%.*$/, '');
  const mapped = IPV4_MAPPED.exec(plain);
  if (mapped?.[1] !== undefined) return mapped[1];
  if (!plain.includes(':')) return plain;
  const [head = '', tail] = plain.toLowerCase().split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const zeros = Array.from({ length: Math.max(0, 8 - left.length - right.length) }, () => '0');
  const groups = [...left, ...zeros, ...right].slice(0, 4);
  return `${groups.map((group) => group.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/**
 * Builds the client key. Behind a trusted proxy the right-most X-Forwarded-For entry is used:
 * it is the one the proxy itself appended, whereas entries to its left are client-supplied.
 * This assumes exactly one proxy hop (a platform load balancer), the supported deployment.
 */
export function clientKey(
  trustProxy: boolean,
  socket: SocketAddress,
): (c: Context<AppEnv>) => string {
  return (c) => {
    if (trustProxy) {
      const forwarded = c.req.header('x-forwarded-for') ?? '';
      const last = forwarded.slice(forwarded.lastIndexOf(',') + 1).trim();
      if (last !== '') return addressKey(last);
    }
    const address = socket(c);
    return address === undefined ? 'unknown' : addressKey(address);
  };
}

function sweepExpired(windows: Map<string, Window>, now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Map order is window-start order, so the first key is the oldest window. */
function evictOldest(windows: Map<string, Window>): void {
  for (const key of windows.keys()) {
    windows.delete(key);
    return;
  }
}

/**
 * Counts requests per client in fixed windows and answers 429 with Retry-After once a client
 * is over the limit. Standard RateLimit-* headers let a well-behaved client pace itself.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const windows = new Map<string, Window>();
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  let sinceSweep = 0;
  return async (c, next) => {
    const now = options.now();
    sinceSweep += 1;
    if (sinceSweep >= SWEEP_EVERY) {
      sinceSweep = 0;
      sweepExpired(windows, now);
    }
    const key = options.keyOf(c);
    let window = windows.get(key);
    if (window === undefined || window.resetAt <= now) {
      windows.delete(key);
      // A full map loses its oldest window: O(1) per request even under an address flood.
      if (windows.size >= maxEntries) evictOldest(windows);
      window = { count: 0, resetAt: now + options.windowMs };
      windows.set(key, window);
    }
    window.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
    c.header('RateLimit-Limit', String(options.max));
    c.header('RateLimit-Remaining', String(Math.max(0, options.max - window.count)));
    c.header('RateLimit-Reset', String(resetSeconds));
    if (window.count > options.max) {
      c.header('Retry-After', String(resetSeconds));
      return problem(c, 429, 'rate-limited', 'Too many requests. Please wait a moment.');
    }
    return next();
  };
}
