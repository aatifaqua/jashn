/**
 * Global hourly budget of Gemini calls, shared by every client, and each client's share of it.
 * They protect the key's quota and cost: once the hour's calls are spent, or one client has
 * used its share, routes serve the deterministic fallback (still a 200 with source "fallback")
 * instead of failing, and one busy client cannot spend the hour for everyone else.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.ts';
import { fixedWindows } from './rateLimit.ts';

const HOUR_MS = 3_600_000;

/**
 * Gives each request a way to take one unit of its client's hourly Gemini share, in fixed
 * one-hour windows per client key. sourced() takes a unit only when it is about to call
 * Gemini, so cached answers and fallbacks cost a client nothing.
 */
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

/** A call budget that refills at the start of each clock hour. */
export interface CallBudget {
  /** Takes one call from the budget; false when the hour's budget is spent. */
  take(): boolean;
}

/** Creates a budget of `perHour` calls; zero disables Gemini entirely. */
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
