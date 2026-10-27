import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env.ts';
import { internalError, serverRequestId } from './errors.ts';

describe('internalError', () => {
  it('answers 500 with a generic body and no error details', async () => {
    const app = new Hono<AppEnv>();
    app.use(serverRequestId());
    app.get('/', () => {
      throw new Error('secret stack detail');
    });
    app.onError(internalError);
    const res = await app.request('/');
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toMatchObject({ error: 'internal', requestId: expect.any(String) });
  });
});
