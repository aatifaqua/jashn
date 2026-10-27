/** The Hono environment shared by the app, its middleware and routes. */
import type { Source } from '@jashn/core';

/**
 * Why a request fell back or failed, for the log line only: the error's class name, the HTTP
 * status Gemini answered with and, for an unexpected 500, the message and stack. Never a
 * request body, a note or the API key.
 */
export interface Failure {
  readonly name: string;
  readonly status?: number;
  readonly message?: string;
  readonly stack?: string;
}

/**
 * Per-request variables: the request id (echoed in every error body so a user can quote it),
 * where a generated answer came from, and why it fell back or failed; the logger records all
 * three.
 */
export interface AppEnv {
  Variables: {
    requestId: string;
    source: Source | undefined;
    failure: Failure | undefined;
    /** Takes one unit of this client's hourly Gemini share; false once it is spent. */
    takeShare: (() => boolean) | undefined;
  };
}
