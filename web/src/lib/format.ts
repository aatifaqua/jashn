/**
 * Display formatting for the web app with Indian conventions. Every Intl formatter is built
 * once at module scope, because constructing one costs far more than calling it and lists
 * format hundreds of values per render.
 */
import { formatCount } from '@jashn/core';

/**
 * The core's formatters under the web app's names, so the page and the core word figures and
 * dates identically: rupees "₹16,00,000", count "2,50,000", dayLabel "20 Feb 2027", longDay
 * "Saturday, 20 February 2027", isoDay for `<time datetime>`.
 */
export {
  formatCount as count,
  formatDay as dayLabel,
  formatLongDay as longDay,
  formatRupees as rupees,
  toIso as isoDay,
} from '@jashn/core';

const MS_PER_DAY = 86_400_000;

const COMPACT_RUPEES = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const PERCENT = new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 0 });
/** Day numbers are UTC midnights, so formatting in UTC never shifts a date by time zone. */
const SHORT_DATE = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** Short rupee figure for tight spaces such as chart labels: 1600000 → "₹16L". */
export function compactRupees(value: number): string {
  return COMPACT_RUPEES.format(value);
}

/** A 0..1 fraction as a whole percentage: 0.3 → "30%". */
export function percent(fraction: number): string {
  return PERCENT.format(fraction);
}

/** A day number as "Sat, 20 Feb", for dense lists where the year is obvious. */
export function shortDay(day: number): string {
  return SHORT_DATE.format(day * MS_PER_DAY);
}

/** "Today", "1 day to go" or "120 days to go". */
export function daysToGoText(days: number): string {
  if (days <= 0) return 'Today';
  return `${formatCount(days)} ${days === 1 ? 'day' : 'days'} to go`;
}

/** How late a task is against its ideal date: "12 days late", or "" when it is not late. */
export function lateByText(idealDue: number, today: number): string {
  const days = today - idealDue;
  if (days <= 0) return '';
  return `${formatCount(days)} ${days === 1 ? 'day' : 'days'} late`;
}
