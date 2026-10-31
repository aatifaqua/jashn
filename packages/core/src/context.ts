/** Derives the facts every later stage needs, once per plan. */
import { SAFETY_THRESHOLDS, expectedHeadcount } from './attendance.ts';
import { fromIso, parseTime, toCivil, weekday as weekdayOf } from './days.ts';
import { WEDDING_FUNCTIONS } from './ids.ts';
import type { EventContext } from './engine-types.ts';
import type { EventInput, FunctionId, Profile } from './types.ts';

interface FunctionDay {
  readonly functionId: FunctionId;
  readonly offset: number;
}

/** Functions held on their own day before the ceremony, in the order they usually happen. */
const BEFORE_CEREMONY: readonly FunctionId[] = WEDDING_FUNCTIONS.filter(
  (id) => id !== 'ceremony' && id !== 'reception',
);

/** Latest start (15:00) at which an intimate ceremony still leaves the evening for a reception. */
const SAME_EVENING_LATEST_START = 15 * 60;

function sameEvening(input: EventInput): boolean {
  return (
    input.style === 'intimate' && (parseTime(input.startTime) ?? 0) <= SAME_EVENING_LATEST_START
  );
}

/** Days of each wedding function relative to the ceremony; an intimate reception is same-day. */
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
    days.push({ functionId: 'reception', offset: sameEvening(input) ? 0 : 1 });
  }
  return days;
}

function spanOf(days: readonly FunctionDay[]): number {
  let first = 0;
  let last = 0;
  for (const { offset } of days) {
    first = Math.min(first, offset);
    last = Math.max(last, offset);
  }
  return last - first + 1;
}

/** Seasons of a month (1 to 12), as inclusive month ranges. */
export function seasonOf(month: number): EventContext['season'] {
  return {
    peakWedding: month >= 11 || month <= 2,
    monsoon: month >= 6 && month <= 9,
    summer: month >= 4 && month <= 6,
  };
}

/** The context of a validated input; a malformed date or time falls back to stay total. */
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
