/** The Hono environment shared by the app, its middleware and routes. */
import type { Source } from '@jashn/core';

/**
 * Per-request variables: the request id (echoed in every error body so a user can quote it)
 * and where a generated answer came from, which the logger records.
 */
export interface AppEnv {
  Variables: { requestId: string; source: Source | undefined };
}
