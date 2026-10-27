/** Headcount, volunteers and crowd-safety thresholds (design section 6.3). */
import type { EventInput, EventType, Profile } from './types.ts';

/**
 * Crowd sizes, in expected guests, that change the plan. One table so the context flags, the
 * rules and the UI copy all use the same numbers.
 */
export const SAFETY_THRESHOLDS = Object.freeze({
  /** A first-aid station from here up. */
  largeCrowd: 200,
  /** A community event this size counts as a public gathering even indoors. */
  publicGathering: 500,
  /** An ambulance on standby from here up. */
  ambulance: 1000,
});

/** One volunteer per this many expected attendees at a community event, with a minimum crew. */
const GUESTS_PER_VOLUNTEER = 50;
const MIN_VOLUNTEERS = 4;

/**
 * Turnout times walk-in factor as a whole number of basis points (0.85 × 1.0 → 8500).
 * Integer basis points keep the headcount exact: 100 × 0.85 in floating point is
 * 85.00000000000001, which would round up to 86.
 */
export function attendanceBasisPoints(profile: Profile, style: string): number {
  const walkIn = profile.styles.find((def) => def.id === style)?.walkIn ?? 1;
  return Math.round(profile.turnout * 100) * Math.round(walkIn * 100);
}

/** Expected headcount for an invited count: invited × turnout × walk-in factor, rounded up. */
export function expectedFor(invited: number, basisPoints: number): number {
  return Math.ceil((invited * basisPoints) / 10_000);
}

/**
 * Expected headcount for the input (design 6.3). Catering and per-guest figures use this
 * number rather than the invited count.
 */
export function expectedHeadcount(input: EventInput, profile: Profile): number {
  return expectedFor(input.invited, attendanceBasisPoints(profile, input.style));
}

/**
 * Largest invited count whose expected headcount stays within `maxExpected`; the inverse of
 * expectedFor, computed exactly with integers instead of by search.
 */
export function maxInvitedFor(maxExpected: number, basisPoints: number): number {
  return Math.floor((Math.max(0, maxExpected) * 10_000) / basisPoints);
}

/** Volunteers a community event needs: max(4, ⌈expected / 50⌉); zero for other types. */
export function volunteersNeeded(type: EventType, expected: number): number {
  if (type !== 'community') return 0;
  return Math.max(MIN_VOLUNTEERS, Math.ceil(expected / GUESTS_PER_VOLUNTEER));
}
