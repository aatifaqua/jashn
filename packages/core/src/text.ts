/** Plain-language formatting with Indian conventions. */
import { MS_PER_DAY } from './days.ts';
import type { EventInput, StyleId } from './types.ts';

/**
 * Intl formatters are built once because constructing one is slow. Dates format in UTC, so the
 * text never shifts with the viewer's time zone.
 */
const COUNT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });
const LONG_DATE = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const SHORT_DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const VOWEL_START = /^[aeiou]/i;

/** How each style reads in a sentence; the Record type keeps it complete as styles change. */
const OCCASIONS: Readonly<Record<StyleId, string>> = Object.freeze({
  traditional: 'traditional wedding',
  intimate: 'intimate wedding',
  destination: 'destination wedding',
  kids: "children's birthday party",
  milestone: 'milestone birthday',
  adult: 'birthday party',
  festival: 'community festival',
  fundraiser: 'community fundraiser',
  meetup: 'community meetup',
  'clean-up': 'community clean-up drive',
});

/** A whole number with Indian grouping: 250000 → "2,50,000"; fractions are rounded. */
export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** A count with the matching noun: (1, 'day', 'days') → "1 day", (2, …) → "2 days". */
export function countWord(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

/** Rupees with Indian grouping and the ₹ sign, no paise: 250000 → "₹2,50,000". */
export function formatRupees(value: number): string {
  return `₹${COUNT.format(value)}`;
}

/** A day number as "20 Feb 2027". */
export function formatDay(day: number): string {
  return DATE.format(day * MS_PER_DAY);
}

/** Weekday of a day number, e.g. "Saturday". */
export function weekdayName(day: number): string {
  return WEEKDAY.format(day * MS_PER_DAY);
}

/** A day number as a long date, e.g. "Saturday, 20 February 2027", for letters and invitations. */
export function formatLongDay(day: number): string {
  return LONG_DATE.format(day * MS_PER_DAY);
}

/** An ISO date (already validated) as a short date, e.g. "20 Feb", for short lists. */
export function formatShortIso(iso: string): string {
  return SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
}

/** A phrase with its indefinite article: "an intimate wedding", "a milestone birthday". */
export function withArticle(phrase: string): string {
  return VOWEL_START.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

/** The event in a few words, e.g. "traditional wedding". */
export function occasion(input: Pick<EventInput, 'type' | 'style'>): string {
  if (Object.hasOwn(OCCASIONS, input.style)) return OCCASIONS[input.style];
  return input.type === 'community' ? 'community event' : input.type;
}
