/**
 * Per-client fixed-window rate limit. Clients are keyed by socket address (IPv6 by its /64);
 * X-Forwarded-For is read only with trust-proxy on, since anyone can forge it.
 */
import { isIP } from 'node:net';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.ts';
import { problem } from './errors.ts';

/** The socket address of a request; undefined when the runtime cannot tell. */
export type SocketAddress = (c: Context<AppEnv>) => string | undefined;

/** Settings for one limiter. */
export interface RateLimitOptions {
  readonly max: number;
  readonly windowMs: number;
  readonly now: () => number;
  readonly keyOf: (c: Context<AppEnv>) => string;
  /** Bounds memory under a flood of addresses. */
  readonly maxEntries?: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
// Expired windows are swept once per this many requests: O(1) amortised.
const SWEEP_EVERY = 256;

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const IPV4_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;
const BRACKETED = /^\[([^\]]+)\](?::\d{1,5})?$/;

// Strips brackets and port: a key per source port would give each connection a fresh window.
function forwardedAddress(entry: string): string | undefined {
  const plain = BRACKETED.exec(entry)?.[1] ?? IPV4_PORT.exec(entry)?.[1] ?? entry;
  return isIP(plain) === 0 ? undefined : plain;
}

/** An IPv6 host usually controls a whole /64, so it is keyed by that network. */
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
 * Behind a trusted proxy, uses the right-most X-Forwarded-For entry: the one the proxy appended
 * (one hop assumed). Anything else is client-supplied; a non-IP entry falls back to the socket.
 */
export function clientKey(
  trustProxy: boolean,
  socket: SocketAddress,
): (c: Context<AppEnv>) => string {
  return (c) => {
    if (trustProxy) {
      const forwarded = c.req.header('x-forwarded-for') ?? '';
      const last = forwardedAddress(forwarded.slice(forwarded.lastIndexOf(',') + 1).trim());
      if (last !== undefined) return addressKey(last);
    }
    const address = socket(c);
    return address === undefined ? 'unknown' : addressKey(address);
  };
}

/** Bounded fixed windows per key: each call counts one hit and returns the key's window. */
export function fixedWindows(
  windowMs: number,
  now: () => number,
  maxEntries = DEFAULT_MAX_ENTRIES,
): (key: string) => Readonly<Window> {
  const windows = new Map<string, Window>();
  let sinceSweep = 0;
  return (key) => {
    const at = now();
    sinceSweep += 1;
    if (sinceSweep >= SWEEP_EVERY) {
      sinceSweep = 0;
      for (const [old, { resetAt }] of windows) if (resetAt <= at) windows.delete(old);
    }
    let window = windows.get(key);
    if (window === undefined || window.resetAt <= at) {
      windows.delete(key);
      // Map order is start order, so a full map drops its oldest window in O(1).
      const oldest = windows.keys().next();
      if (windows.size >= maxEntries && oldest.done !== true) windows.delete(oldest.value);
      window = { count: 0, resetAt: at + windowMs };
      windows.set(key, window);
    }
    window.count += 1;
    return window;
  };
}

/** 429 with Retry-After over the limit; RateLimit-* headers let a client pace itself. */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const hit = fixedWindows(options.windowMs, options.now, options.maxEntries);
  return async (c, next) => {
    const window = hit(options.keyOf(c));
    const now = options.now();
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
