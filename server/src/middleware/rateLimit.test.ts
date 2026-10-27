import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env.ts';
import { serverRequestId } from './errors.ts';
import { addressKey, clientKey, rateLimit, type RateLimitOptions } from './rateLimit.ts';

function limited(options: Partial<RateLimitOptions> & { now: () => number }) {
  const app = new Hono<AppEnv>();
  app.use(serverRequestId());
  app.use(
    rateLimit({
      max: 1,
      windowMs: 1000,
      keyOf: (c) => c.req.header('x-client') ?? 'none',
      ...options,
    }),
  );
  app.get('/', (c) => c.text('ok'));
  return (client: string) => app.request('/', { headers: { 'x-client': client } });
}

describe('rateLimit', () => {
  it('resets each client when its window ends', async () => {
    let now = 0;
    const hit = limited({ now: () => now });
    expect((await hit('a')).status).toBe(200);
    expect((await hit('a')).status).toBe(429);
    expect((await hit('b')).status).toBe(200);
    now = 1000;
    expect((await hit('a')).status).toBe(200);
  });

  it('bounds the number of tracked clients by evicting the oldest', async () => {
    const hit = limited({ now: () => 0, maxEntries: 2 });
    await hit('a');
    await hit('b');
    await hit('c'); // full: a is evicted
    expect((await hit('a')).status).toBe(200);
  });

  it('sweeps expired windows periodically', async () => {
    let now = 0;
    const hit = limited({ now: () => now, maxEntries: 1000 });
    for (let i = 0; i < 300; i += 1) await hit(`client-${String(i)}`);
    now = 5000;
    expect((await hit('client-1')).status).toBe(200);
  });
});

describe('clientKey', () => {
  const app = (trustProxy: boolean, socket: string | undefined) => {
    const hono = new Hono<AppEnv>();
    const key = clientKey(trustProxy, () => socket);
    hono.get('/', (c) => c.text(key(c)));
    return (xff?: string) =>
      Promise.resolve(
        hono.request('/', { headers: xff === undefined ? {} : { 'x-forwarded-for': xff } }),
      ).then((res) => res.text());
  };

  it('uses the socket address unless trust-proxy is on', async () => {
    expect(await app(false, '10.0.0.1')('1.1.1.1')).toBe('10.0.0.1');
  });

  it('uses the right-most forwarded hop behind a trusted proxy', async () => {
    expect(await app(true, '10.0.0.1')('6.6.6.6, 1.1.1.1')).toBe('1.1.1.1');
  });

  it('falls back to the socket, then to a shared key', async () => {
    expect(await app(true, '10.0.0.1')()).toBe('10.0.0.1');
    expect(await app(true, undefined)(' ')).toBe('unknown');
  });
});

describe('addressKey', () => {
  it('keeps IPv4 addresses and unwraps IPv4-mapped IPv6', () => {
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7');
    expect(addressKey('::FFFF:203.0.113.7')).toBe('203.0.113.7');
  });

  it('keys IPv6 addresses by their /64 network', () => {
    const key = '2001:db8:0:1::/64';
    expect(addressKey('2001:db8:0:1::1')).toBe(key);
    expect(addressKey('2001:0db8:0000:0001:ffff:1:2:3')).toBe(key);
    expect(addressKey('2001:DB8:0:1:aaaa::9%eth0')).toBe(key);
    expect(addressKey('::1')).toBe('0:0:0:0::/64');
    expect(addressKey('fe80::')).toBe('fe80:0:0:0::/64');
  });

  it('gives one window to a client rotating addresses within its /64', async () => {
    const hono = new Hono<AppEnv>();
    let n = 0;
    hono.use(serverRequestId());
    hono.use(
      rateLimit({
        max: 1,
        windowMs: 1000,
        now: () => 0,
        keyOf: clientKey(false, () => `2001:db8::${String((n += 1))}`),
      }),
    );
    hono.get('/', (c) => c.text('ok'));
    expect((await hono.request('/')).status).toBe(200);
    expect((await hono.request('/')).status).toBe(429);
  });
});
