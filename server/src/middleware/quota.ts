/**
 * Hourly Gemini budget for all clients plus each client's share, protecting the key's quota.
 * Once spent, routes serve the fallback (still a 200) and one client cannot starve the rest.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.ts';
import { fixedWindows } from './rateLimit.ts';

const HOUR_MS = 3_600_000;

/** sourced() takes a unit only right before calling Gemini, so cache hits cost nothing. */
export function clientShare(
  perClient: number,
  now: () => number,
  keyOf: (c: Context<AppEnv>) => string,
): MiddlewareHandler<AppEnv> {
  const hit = fixedWindows(HOUR_MS, now);
  return async (c, next) => {
    c.set('takeShare', () => hit(keyOf(c)).count <= perClient);
    await next();
  };
}

/** Each model call takes one unit; false once the budget is spent. */
export interface CallBudget {
  take(): boolean;
}

/** Refills each clock hour; zero disables Gemini. */
export function hourlyBudget(perHour: number, now: () => number): CallBudget {
  let hour = -1;
  let used = 0;
  return {
    take() {
      const current = Math.floor(now() / HOUR_MS);
      if (current !== hour) {
        hour = current;
        used = 0;
      }
      if (used >= perHour) return false;
      used += 1;
      return true;
    },
  };
}
