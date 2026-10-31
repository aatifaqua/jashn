/**
 * Web-only display formatting; the core formats rupees, counts and dates. Intl formatters are
 * built once at module scope, because constructing one costs far more than calling it.
 */
import { MS_PER_DAY, countWord, toCivil } from '@jashn/core';

const PERCENT = new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 0 });
/** Day numbers are UTC midnights, so formatting in UTC never shifts a date by time zone. */
const SHORT_DATE = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const SHORT_DATE_YEAR = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A 0..1 fraction as a whole percentage: 0.3 → "30%". */
export function percent(fraction: number): string {
  return PERCENT.format(fraction);
}

/**
 * A day number as "Sat, 20 Feb" for dense lists, with the year ("Sat, 20 Feb 2027") when it is
 * not the year of `today`: a plan can run up to three years ahead.
 */
export function shortDay(day: number, today: number): string {
  const sameYear = toCivil(day).year === toCivil(today).year;
  return (sameYear ? SHORT_DATE : SHORT_DATE_YEAR).format(day * MS_PER_DAY);
}

/** "Today", "1 day to go", "120 days to go", or "Held 3 days ago" once the day has passed. */
export function daysToGoText(days: number): string {
  if (days === 0) return 'Today';
  if (days < 0) return `Held ${countWord(-days, 'day', 'days')} ago`;
  return `${countWord(days, 'day', 'days')} to go`;
}

/** How late a task is against its ideal date: "12 days late", or "" when it is not late. */
export function lateByText(idealDue: number, today: number): string {
  const days = today - idealDue;
  if (days <= 0) return '';
  return `${countWord(days, 'day', 'days')} late`;
}
