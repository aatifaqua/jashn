/** The Hono environment shared by the app, its middleware and routes. */
import type { Source } from '@jashn/core';

/** Why a request fell back or failed, for the log only; never a body, a note or the key. */
export interface Failure {
  readonly name: string;
  readonly status?: number;
  readonly message?: string;
  readonly stack?: string;
}

/** Per-request variables (request id, source, fallback reason) that the logger records. */
export interface AppEnv {
  Variables: {
    requestId: string;
    source: Source | undefined;
    failure: Failure | undefined;
    takeShare: (() => boolean) | undefined;
  };
}
