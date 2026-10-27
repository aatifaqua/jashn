/**
 * One structured log line per request. It records the request id, route, method, status,
 * latency, the source of any generated answer and, when Gemini fell back or the request failed,
 * why (the error's name and status; for a 500 also its message and stack). Nothing else: no
 * bodies, notes, user messages, query strings, addresses or headers, so logs can never hold
 * what a user typed, and the id a user quotes finds the line that explains it.
 */
import type { MiddlewareHandler } from 'hono';
import type { Source } from '@jashn/core';
import type { AppEnv, Failure } from '../env.ts';

/** What gets logged for a request. */
export interface LogEntry {
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly status: number;
  readonly ms: number;
  readonly source: Source | null;
  readonly failure?: Failure;
}

/** Where log entries go; injected so tests can capture them. */
export type LogSink = (entry: LogEntry) => void;

/** Paths are capped so a crafted URL cannot bloat a log line. */
const ROUTE_MAX = 80;

/** Writes each entry as one JSON line on stdout, the format log collectors expect. */
export const stdoutSink: LogSink = (entry) => {
  console.log(JSON.stringify(entry));
};

/** Logs every request after it completes, including error responses. */
export function requestLogger(sink: LogSink, now: () => number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const started = now();
    await next();
    const { failure } = c.var;
    sink({
      requestId: c.var.requestId,
      route: c.req.path.slice(0, ROUTE_MAX),
      method: c.req.method,
      status: c.res.status,
      ms: Math.max(0, Math.round(now() - started)),
      source: c.var.source ?? null,
      ...(failure === undefined ? {} : { failure }),
    });
  };
}
