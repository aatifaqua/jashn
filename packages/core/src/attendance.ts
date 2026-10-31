/** Headcount, volunteers and crowd-safety thresholds. */
import type { EventInput, EventType, Profile } from './types.ts';

/** Crowd sizes that change the plan; one table for the context, rules and UI copy. */
export const SAFETY_THRESHOLDS = Object.freeze({
  largeCrowd: 200,
  /** A community event this size counts as a public gathering even indoors. */
  publicGathering: 500,
  ambulance: 1000,
});

/** One volunteer per this many expected attendees at a community event, with a minimum crew. */
const GUESTS_PER_VOLUNTEER = 50;
const MIN_VOLUNTEERS = 4;

/** Integer basis points keep the headcount exact: 100 × 0.85 in floats rounds up to 86. */
export function attendanceBasisPoints(profile: Profile, style: string): number {
  const walkIn = profile.styles.find((def) => def.id === style)?.walkIn ?? 1;
  return Math.round(profile.turnout * 100) * Math.round(walkIn * 100);
}

/** Expected headcount: invited times turnout times the walk-in factor, rounded up. */
export function expectedFor(invited: number, basisPoints: number): number {
  return Math.ceil((invited * basisPoints) / 10_000);
}

/** Expected headcount; catering and per-guest figures use it, not invited. */
export function expectedHeadcount(input: EventInput, profile: Profile): number {
  return expectedFor(input.invited, attendanceBasisPoints(profile, input.style));
}

/** Largest invited count whose expected headcount stays within `maxExpected`. */
export function maxInvitedFor(maxExpected: number, basisPoints: number): number {
  return Math.floor((Math.max(0, maxExpected) * 10_000) / basisPoints);
}

/** Volunteers a community event needs: max(4, ⌈expected / 50⌉); zero for other types. */
export function volunteersNeeded(type: EventType, expected: number): number {
  if (type !== 'community') return 0;
  return Math.max(MIN_VOLUNTEERS, Math.ceil(expected / GUESTS_PER_VOLUNTEER));
}
