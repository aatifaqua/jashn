/** Date guard: generated text may repeat a date the engine computed, never an invented one. */
import { functionDays } from './context.ts';
import { daysInMonth, fromCivil, fromIso, toCivil } from './days.ts';
import type { Plan, PlanPatch } from './types.ts';

const MONTH_WORDS: readonly (readonly string[])[] = Object.freeze([
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sept', 'sep'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
]);

const MONTH_OF: ReadonlyMap<string, number> = new Map(
  MONTH_WORDS.flatMap((words, index) => words.map((word) => [word, index + 1] as const)),
);
/** Longest first, so "sept" wins over "sep" and "march" over "mar". */
const MONTH = [...MONTH_OF.keys()].sort((a, b) => b.length - a.length).join('|');
const ORDINAL = String.raw`(?:st|nd|rd|th)?`;
/** Only 20xx reads as a year, so "20 Feb 1500 guests" or "1800 hrs" is not a dated year. */
const YEAR = String.raw`(?:,?\s+(20\d{2})(?!\d))?`;
/** No letter or combining mark may follow, so "mar" never matches inside "marigold". */
const EDGE = String.raw`(?![\p{L}\p{M}])`;

interface Mention {
  readonly year: number | undefined;
  readonly month: number;
  readonly day: number;
}

function monthOf(word: string | undefined): number {
  return Number(MONTH_OF.get(String(word).toLowerCase()));
}

/** A lowercase "may" is the verb ("20 may need seating"), not the month. */
function isVerb(word: string | undefined): boolean {
  return word === 'may';
}

function yearOf(year: string | undefined): number | undefined {
  return year === undefined ? undefined : Number(year);
}

interface Form {
  readonly pattern: RegExp;
  readonly read: (groups: RegExpMatchArray) => Mention | null;
}

/** "6th of March 2027", "March 6, 2027", ISO, and Indian day-first "06/03/2027". */
const FORMS: readonly Form[] = Object.freeze([
  {
    pattern: new RegExp(
      String.raw`(?<!\d)(\d{1,2})${ORDINAL}\s+(?:of\s+)?(${MONTH})\.?${EDGE}${YEAR}`,
      'giu',
    ),
    read: (g) =>
      isVerb(g[2]) ? null : { day: Number(g[1]), month: monthOf(g[2]), year: yearOf(g[3]) },
  },
  {
    pattern: new RegExp(
      String.raw`(?<![\p{L}\p{M}])(${MONTH})\.?\s+(\d{1,2})${ORDINAL}(?!\d)${YEAR}`,
      'giu',
    ),
    read: (g) =>
      isVerb(g[1]) ? null : { day: Number(g[2]), month: monthOf(g[1]), year: yearOf(g[3]) },
  },
  {
    pattern: /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g,
    read: (g) => ({ day: Number(g[3]), month: Number(g[2]), year: Number(g[1]) }),
  },
  {
    pattern: /(?<![\d/.-])(\d{1,2})([/.-])(\d{1,2})\2(20\d{2})(?!\d)/g,
    read: (g) => ({ day: Number(g[1]), month: Number(g[3]), year: Number(g[4]) }),
  },
]);

function monthDay(month: number, day: number): string {
  return `${String(month)}-${String(day)}`;
}

/** Every day the plan (and an optional proposed patch) states. */
export function planDays(plan: Plan, patch?: PlanPatch): ReadonlySet<number> {
  const eventDay = plan.today + plan.daysToGo;
  const days = new Set<number>([plan.today, eventDay]);
  for (const fn of functionDays(plan.input)) days.add(eventDay + fn.offset);
  for (const task of plan.tasks) days.add(task.due).add(task.idealDue);
  for (const vendor of plan.vendors) days.add(vendor.bookBy);
  for (const payment of plan.payments) days.add(payment.due);
  for (const slot of plan.runSheet) days.add(slot.day);
  const patched = fromIso(patch?.date ?? '');
  if (patched !== null) days.add(patched);
  return days;
}

function isKnown(date: Mention, allowed: ReadonlySet<number>, loose: ReadonlySet<string>): boolean {
  const { year, month, day } = date;
  // A year-less date may be 29 February, so it is checked against a leap year.
  const valid = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year ?? 2024, month);
  if (!valid) return false;
  return year === undefined
    ? loose.has(monthDay(month, day))
    : allowed.has(fromCivil(year, month, day));
}

/** Dates not in `allowed`, as written; a year-less date matches by day and month. */
export function inventedDates(text: string, allowed: ReadonlySet<number>): readonly string[] {
  const loose = new Set(
    [...allowed].map((day) => {
      const civil = toCivil(day);
      return monthDay(civil.month, civil.day);
    }),
  );
  const invented: string[] = [];
  for (const { pattern, read } of FORMS) {
    for (const match of text.matchAll(pattern)) {
      const date = read(match);
      if (date !== null && !isKnown(date, allowed, loose)) invented.push(match[0]);
    }
  }
  return invented;
}
