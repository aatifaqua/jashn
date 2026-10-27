/**
 * Global hourly budget of Gemini calls, shared by every client. It protects the key's quota
 * and cost: once the hour's calls are spent, routes serve the deterministic fallback (still a
 * 200 with source "fallback") instead of failing.
 */

const HOUR_MS = 3_600_000;

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
