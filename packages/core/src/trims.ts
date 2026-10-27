/**
 * Suggested savings, each with the amount it frees (design 6.4). Trims never apply
 * themselves; the user or the assistant turns one into a patch.
 */
import { attendanceBasisPoints, expectedFor, maxInvitedFor } from './attendance.ts';
import { functionDays } from './context.ts';
import { ROUNDING_UNIT, roundRupees } from './money.ts';
import { formatCount, formatDay, formatRupees, weekdayName } from './text.ts';
import type {
  BudgetLine,
  CityTier,
  EventContext,
  EventInput,
  Profile,
  Trim,
  Verdict,
} from './types.ts';

/** Everything a trim needs to price itself. */
export interface TrimContext {
  readonly input: EventInput;
  readonly profile: Profile;
  readonly ctx: EventContext;
  readonly lines: readonly BudgetLine[];
  /** Cost floor per expected guest. */
  readonly floor: number;
  readonly verdict: Verdict;
}

/** Editorial saving estimates, as fractions of the affected line. */
const SAVING = Object.freeze({ weekday: 0.1, lunch: 0.15, merge: 0.5, eInvites: 0.8 });
/** A start at or after this minute of the day means the main meal is dinner. */
const DINNER_FROM = 17 * 60;
const TIER_TEXT: Readonly<Record<CityTier, string>> = {
  metro: 'metro',
  tier2: 'tier-2 city',
  town: 'town',
};

function amountOf(lines: readonly BudgetLine[], category: string): number {
  return lines.find((line) => line.category === category)?.amount ?? 0;
}

/** Catering for weddings, food for the other types; no profile has both. */
function foodAmount(lines: readonly BudgetLine[]): number {
  return amountOf(lines, 'catering') + amountOf(lines, 'food');
}

function trim(id: string, label: string, saves: number, text: string): Trim {
  return { id, label, saves, reasons: [{ code: id, text }] };
}

/**
 * Largest invited count that lifts the verdict one step: to the floor when unrealistic, to
 * 1.5 × the floor when tight. Same integer test as verdictFor, so the trim and the verdict
 * always agree.
 */
function inviteFewer({ input, profile, ctx, lines, floor, verdict }: TrimContext): Trim | null {
  const basisPoints = attendanceBasisPoints(profile, input.style);
  const reachFloor = verdict === 'unrealistic';
  const maxExpected = reachFloor
    ? Math.floor(input.budget / floor)
    : Math.floor((2 * input.budget) / (3 * floor));
  const invited = maxInvitedFor(maxExpected, basisPoints);
  if (invited < 1 || invited >= input.invited) return null;
  const attend = expectedFor(invited, basisPoints);
  const perGuest = formatRupees(Math.floor(input.budget / attend));
  const target = reachFloor
    ? 'at least the modest minimum'
    : 'a comfortable margin above the minimum';
  return trim(
    'invite-fewer',
    `Invite ${formatCount(invited)} guests instead of ${formatCount(input.invited)}`,
    roundRupees((foodAmount(lines) * (ctx.expected - attend)) / ctx.expected),
    `About ${formatCount(attend)} would attend, giving ${perGuest} per guest: ${target} of ${formatRupees(floor)} for a ${TIER_TEXT[input.tier]} ${profile.label.toLowerCase()}.`,
  );
}

/** Not offered once the venue is booked: its date and price are already contracted. */
function weekdayDate({ input, ctx, lines }: TrimContext): Trim | null {
  if (input.venueBooked || ctx.midweek) return null;
  return trim(
    'weekday',
    'Move to a weekday (Monday to Thursday)',
    roundRupees(amountOf(lines, 'venue') * SAVING.weekday),
    `${formatDay(ctx.eventDay)} is a ${weekdayName(ctx.eventDay)}; venues often charge about 10 % less midweek.`,
  );
}

function lunch({ input, ctx, lines }: TrimContext): Trim | null {
  if (ctx.startMinutes < DINNER_FROM) return null;
  return trim(
    'lunch',
    'Serve lunch instead of dinner',
    roundRupees(foodAmount(lines) * SAVING.lunch),
    `Starting at ${input.startTime} means a dinner; a lunch menu usually costs about 15 % less.`,
  );
}

/**
 * Folds the two smallest functions held before the ceremony (haldi, mehndi, sangeet) into one
 * day. The reception comes after the ceremony, so it is never merged with them.
 */
function mergeFunctions({ input, profile, lines }: TrimContext): Trim | null {
  const chosen = profile.functions.filter((def) => input.functions.includes(def.id));
  const before = new Set(
    functionDays(input)
      .filter((day) => day.offset < 0)
      .map((d) => d.functionId),
  );
  const [smaller, other] = chosen
    .filter((def) => before.has(def.id))
    .sort((a, b) => a.guestShare - b.guestShare);
  if (smaller === undefined || other === undefined) return null;
  const totalShare = chosen.reduce((sum, def) => sum + def.guestShare, 0);
  const splitLines = amountOf(lines, 'catering') + amountOf(lines, 'decor');
  const first = smaller.label.toLowerCase();
  return trim(
    'merge-functions',
    `Hold the ${first} and ${other.label.toLowerCase()} on one day`,
    roundRupees(((splitLines * smaller.guestShare) / totalShare) * SAVING.merge),
    `You chose ${formatCount(chosen.length)} functions; sharing one set-up and one meal service halves the ${first} catering and decor.`,
  );
}

function eInvites({ input, lines }: TrimContext): Trim | null {
  if (input.constraints.includes('eco-friendly')) return null;
  return trim(
    'e-invites',
    'Send e-invites instead of printed cards',
    roundRupees(amountOf(lines, 'invitations') * SAVING.eInvites),
    'Printed cards and their delivery make up most of the invitations line.',
  );
}

function sponsorship({ input, ctx, floor }: TrimContext): Trim | null {
  const shortfall = floor * ctx.expected - input.budget;
  if (input.type !== 'community' || shortfall <= 0) return null;
  const target = Math.ceil(shortfall / ROUNDING_UNIT) * ROUNDING_UNIT;
  return trim(
    'sponsorship',
    `Raise ${formatRupees(target)} from sponsors`,
    target,
    `About ${formatCount(ctx.expected)} people at ${formatRupees(floor)} each need ${formatRupees(floor * ctx.expected)}; your budget is ${formatRupees(input.budget)}.`,
  );
}

/** Trim builders; each returns null when its trim does not fit the event. */
const BUILDERS = Object.freeze([
  inviteFewer,
  weekdayDate,
  lunch,
  mergeFunctions,
  eInvites,
  sponsorship,
]);

/**
 * Every trim that saves something for this event, largest saving first (ties by id so the
 * order is stable).
 */
export function rankTrims(context: TrimContext): Trim[] {
  const trims: Trim[] = [];
  for (const build of BUILDERS) {
    const found = build(context);
    if (found !== null && found.saves > 0) trims.push(found);
  }
  return trims.sort((a, b) => b.saves - a.saves || a.id.localeCompare(b.id));
}
