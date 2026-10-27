/** Derives the facts every later stage needs, once per plan (design section 6.1). */
import { SAFETY_THRESHOLDS, expectedHeadcount } from './attendance.ts';
import { fromIso, parseTime, toCivil, weekday as weekdayOf } from './days.ts';
import { WEDDING_FUNCTIONS } from './ids.ts';
import type { EventContext, EventInput, FunctionId, Profile } from './types.ts';

/** A wedding function placed on a day relative to the event day (the ceremony, offset 0). */
export interface FunctionDay {
  readonly functionId: FunctionId;
  readonly offset: number;
}

/** Functions held on their own day before the ceremony, in the order they usually happen. */
const BEFORE_CEREMONY: readonly FunctionId[] = WEDDING_FUNCTIONS.filter(
  (id) => id !== 'ceremony' && id !== 'reception',
);

/**
 * Days of each chosen wedding function relative to the ceremony: earlier functions on
 * consecutive days ending the day before it, and the reception the next day (the same evening
 * for an intimate wedding, where guests rarely stay over). Empty for other event types.
 */
export function functionDays(input: EventInput): readonly FunctionDay[] {
  if (input.type !== 'wedding') return [];
  const chosen = new Set(input.functions);
  const before = BEFORE_CEREMONY.filter((id) => chosen.has(id));
  const days: FunctionDay[] = before.map((functionId, index) => ({
    functionId,
    offset: index - before.length,
  }));
  days.push({ functionId: 'ceremony', offset: 0 });
  if (chosen.has('reception')) {
    days.push({ functionId: 'reception', offset: input.style === 'intimate' ? 0 : 1 });
  }
  return days;
}

/** Calendar days covered by the function days; 1 for a single-day event. */
function spanOf(days: readonly FunctionDay[]): number {
  let first = 0;
  let last = 0;
  for (const { offset } of days) {
    first = Math.min(first, offset);
    last = Math.max(last, offset);
  }
  return last - first + 1;
}

/**
 * Seasons of a calendar month (1–12). Month ranges are inclusive and read straight from design
 * 6.1; exported so the offline ideas pick seasonal entries by the same definition.
 */
export function seasonOf(month: number): EventContext['season'] {
  return {
    peakWedding: month >= 11 || month <= 2,
    monsoon: month >= 6 && month <= 9,
    summer: month >= 4 && month <= 6,
  };
}

/**
 * Computes the event context from a validated input. `today` is a day number; the profile
 * supplies turnout and the minimum lead time. Malformed date or time (never the case after
 * validateInput) fall back to today and midnight so the function stays total.
 */
export function deriveContext(input: EventInput, today: number, profile: Profile): EventContext {
  const eventDay = fromIso(input.date) ?? today;
  const day = weekdayOf(eventDay);
  const expected = expectedHeadcount(input, profile);
  const daysToGo = eventDay - today;
  const outdoor = input.setting !== 'indoor';
  const { month } = toCivil(eventDay);
  return {
    today,
    eventDay,
    daysToGo,
    weekday: day,
    midweek: day >= 1 && day <= 4,
    month,
    season: seasonOf(month),
    spanDays: spanOf(functionDays(input)),
    expected,
    startMinutes: parseTime(input.startTime) ?? 0,
    flags: {
      outdoor,
      largeCrowd: expected >= SAFETY_THRESHOLDS.largeCrowd,
      publicGathering:
        input.type === 'community' && (outdoor || expected >= SAFETY_THRESHOLDS.publicGathering),
      shortNotice: daysToGo < profile.minLeadDays,
    },
  };
}
