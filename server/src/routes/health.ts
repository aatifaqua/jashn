/** GET /api/health: liveness and whether answers come from Gemini; cacheable, never calls it. */
import type { Source } from '@jashn/core';
import type { Handler } from 'hono';
import type { AppEnv } from '../env.ts';

/** Cacheable for a minute, so probes can call it freely without touching Gemini. */
export function healthHandler(live: boolean): Handler<AppEnv> {
  const genai: Source = live ? 'gemini' : 'fallback';
  return (c) => {
    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ status: 'ok', genai });
  };
}
