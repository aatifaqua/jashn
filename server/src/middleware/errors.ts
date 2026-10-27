/**
 * Error responses. Every body is generic JSON with a stable code, a plain message and the
 * request id; nothing from the request and no stack trace is ever echoed back.
 */
import type { Context, ErrorHandler, MiddlewareHandler, NotFoundHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../env.ts';

/** Request bodies above this many bytes are refused before they are read. */
export const BODY_LIMIT_BYTES = 16 * 1024;

/** A problem with one field of a request, in the same shape as the core's field errors. */
export interface FieldIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/** The JSON body of every error response. */
export interface ErrorBody {
  readonly error: string;
  readonly message: string;
  readonly requestId: string;
  readonly fields?: readonly FieldIssue[];
}

/**
 * Gives each request a fresh server-generated id, returned in X-Request-Id and in error bodies.
 * A client-supplied id is ignored, so an id a user quotes always names a real server request.
 */
export function serverRequestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}

/** Sends an error body with the request id; `fields` only for validation failures. */
export function problem(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  error: string,
  message: string,
): Response {
  const body: ErrorBody = { error, message, requestId: c.var.requestId };
  return c.json(body, status);
}

/** 400 with every field problem, so the form can show them inline and in its summary. */
export function invalidRequest(c: Context<AppEnv>, fields: readonly FieldIssue[]): Response {
  const body: ErrorBody = {
    error: 'invalid-request',
    message: 'Some fields need attention.',
    requestId: c.var.requestId,
    fields,
  };
  return c.json(body, 400);
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

/** 413 for bodies over the limit, checked from Content-Length or while reading, never after. */
export function sizeLimit(): MiddlewareHandler<AppEnv> {
  return bodyLimit({
    maxSize: BODY_LIMIT_BYTES,
    onError: (c) =>
      problem(c as Context<AppEnv>, 413, 'payload-too-large', 'The request is too large.'),
  });
}

/** 404 for unknown routes. */
export const notFound: NotFoundHandler<AppEnv> = (c) =>
  problem(c, 404, 'not-found', 'There is nothing here.');

/** 500 for anything unexpected; no details leave the server (the logger records the status). */
export const internalError: ErrorHandler<AppEnv> = (_error, c) =>
  problem(c, 500, 'internal', 'Something went wrong. Please try again.');
