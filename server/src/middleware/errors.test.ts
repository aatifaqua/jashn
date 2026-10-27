import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env.ts';
import { internalError, serverRequestId } from './errors.ts';
import { requestLogger, type LogEntry } from './logger.ts';

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

  it('records the error under the request id on the log line, not in the body', async () => {
    const logs: LogEntry[] = [];
    const app = new Hono<AppEnv>();
    app.use(serverRequestId());
    app.use(
      requestLogger(
        (entry) => logs.push(entry),
        () => 0,
      ),
    );
    app.get('/', () => {
      throw new TypeError('plan.tasks is undefined');
    });
    app.onError(internalError);
    const res = await app.request('/');
    const [entry] = logs;
    expect(entry?.requestId).toBe(res.headers.get('X-Request-Id'));
    expect(entry).toMatchObject({
      status: 500,
      failure: { name: 'TypeError', message: 'plan.tasks is undefined' },
    });
    expect(entry?.failure?.stack).toContain('TypeError');
    const bare = new Hono<AppEnv>();
    bare.get('/', () => {
      const error = new Error('no stack');
      delete error.stack;
      throw error;
    });
    bare.onError(internalError);
    expect((await bare.request('/')).status).toBe(500);
  });
});
