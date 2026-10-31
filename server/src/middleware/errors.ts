/**
 * Error responses: generic JSON with a stable code, a plain message and the request id. Nothing
 * from the request and no stack trace is ever echoed back.
 */
import type { Context, ErrorHandler, MiddlewareHandler, NotFoundHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../env.ts';

/** Larger request bodies are refused before they are read. */
export const BODY_LIMIT_BYTES = 16 * 1024;

/** One field's problem, in the same shape as the core's field errors. */
export interface FieldIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/** A client-supplied id is ignored, so an id a user quotes always names a real server request. */
export function serverRequestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}

/** An error body with the request id; `fields` only for validation failures. */
export function problem(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  error: string,
  message: string,
): Response {
  return c.json({ error, message, requestId: c.var.requestId }, status);
}

/** 400 with every field problem, so the form can show them inline. */
export function invalidRequest(c: Context<AppEnv>, fields: readonly FieldIssue[]): Response {
  const message = 'Some fields need attention.';
  return c.json({ error: 'invalid-request', message, requestId: c.var.requestId, fields }, 400);
}

/** 415 unless the request declares a JSON body; the API accepts nothing else. */
export function jsonOnly(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const type = c.req.header('content-type') ?? '';
    if (!/^application\/json\s*(?:;|$)/i.test(type)) {
      return problem(c, 415, 'unsupported-media-type', 'Send the request as application/json.');
    }
    return next();
  };
}

/**
 * Refuses oversized bodies from Content-Length or while reading, never after. The limit is set
 * up per request so its error handler answers through this request's typed context.
 */
export function sizeLimit(): MiddlewareHandler<AppEnv> {
  return (c, next) =>
    bodyLimit({
      maxSize: BODY_LIMIT_BYTES,
      onError: () => problem(c, 413, 'payload-too-large', 'The request is too large.'),
    })(c, next);
}

/** 404 for unknown routes, in the same error shape as every other failure. */
export const notFound: NotFoundHandler<AppEnv> = (c) =>
  problem(c, 404, 'not-found', 'There is nothing here.');

// Caps on what an unexpected error contributes to its log line.
const MESSAGE_MAX = 200;
const STACK_MAX = 2000;

/** Generic 500 body; the details go only to the log line under the same request id. */
export const internalError: ErrorHandler<AppEnv> = (error, c) => {
  c.set('failure', {
    name: error.name,
    message: error.message.slice(0, MESSAGE_MAX),
    stack: (error.stack ?? '').slice(0, STACK_MAX),
  });
  return problem(c, 500, 'internal', 'Something went wrong. Please try again.');
};
