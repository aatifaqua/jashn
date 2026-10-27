/** GET /api/health: liveness plus whether generated content comes from Gemini or the fallbacks. */
import type { Source } from '@jashn/core';
import type { Handler } from 'hono';
import type { AppEnv } from '../env.ts';

/** The health response body. */
export interface Health {
  readonly status: 'ok';
  /** "fallback" when the server runs without a Gemini key. */
  readonly genai: Source;
}

/**
 * Cheap and cacheable for a minute, so uptime probes and the web app can call it freely
 * without touching Gemini.
 */
export function healthHandler(live: boolean): Handler<AppEnv> {
  const body: Health = { status: 'ok', genai: live ? 'gemini' : 'fallback' };
  return (c) => {
    c.header('Cache-Control', 'public, max-age=60');
    return c.json(body);
  };
}
