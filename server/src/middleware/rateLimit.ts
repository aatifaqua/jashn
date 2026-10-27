/**
 * Per-client fixed-window rate limit for the generative routes. Clients are keyed by socket
 * address (IPv6 by its /64 network); X-Forwarded-For is read only when the operator switches
 * trust-proxy on, because anyone can send that header and would otherwise pick a fresh
 * identity per request.
 */
import { isIP } from 'node:net';
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

/** One client's fixed window: requests counted so far and when the window ends. */
export interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
/** Expired windows are swept once per this many requests, keeping each request O(1) amortised. */
const SWEEP_EVERY = 256;

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
/** "203.0.113.7:51000", as some proxies append it. */
const IPV4_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;
/** "[2001:db8::1]" or "[2001:db8::1]:51000". */
const BRACKETED = /^\[([^\]]+)\](?::\d{1,5})?$/;

/**
 * The address in one X-Forwarded-For entry, without brackets or a port; undefined when it is
 * not an IP address at all. Some proxies append "ip:port", and a key per source port would
 * hand every new connection a fresh window.
 */
export function forwardedAddress(entry: string): string | undefined {
  const plain = BRACKETED.exec(entry)?.[1] ?? IPV4_PORT.exec(entry)?.[1] ?? entry;
  return isIP(plain) === 0 ? undefined : plain;
}

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
 * This assumes exactly one proxy hop (a platform load balancer), the supported deployment. An
 * entry that is not an IP address is ignored in favour of the socket address.
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
 * Fixed windows per key in a bounded map: each call counts one hit for the key and returns its
 * window. Shared by the request limit and the per-client share of the Gemini budget.
 */
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
      sweepExpired(windows, at);
    }
    let window = windows.get(key);
    if (window === undefined || window.resetAt <= at) {
      windows.delete(key);
      // A full map loses its oldest window: O(1) per request even under an address flood.
      if (windows.size >= maxEntries) evictOldest(windows);
      window = { count: 0, resetAt: at + windowMs };
      windows.set(key, window);
    }
    window.count += 1;
    return window;
  };
}

/**
 * Counts requests per client in fixed windows and answers 429 with Retry-After once a client
 * is over the limit. Standard RateLimit-* headers let a well-behaved client pace itself.
 */
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
