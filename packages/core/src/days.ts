/**
 * Dates as integer days since 1970-01-01, ruling out time-zone and daylight-saving bugs.
 * Conversions use Howard Hinnant's civil-calendar algorithms, with no Date allocation.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAYS_PER_ERA = 146_097;
const EPOCH_SHIFT = 719_468;
const MINUTES_PER_DAY = 1440;

interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Days in a month (1 to 12) of a year, leap years included. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Day number of a calendar date; the inputs must already be a valid date. */
export function fromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - EPOCH_SHIFT;
}

/** Calendar year, month and day of a day number. */
export function toCivil(dayNumber: number): CivilDate {
  const z = dayNumber + EPOCH_SHIFT;
  const era = Math.floor(z / DAYS_PER_ERA);
  const dayOfEra = z - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shifted = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shifted + 2) / 5) + 1;
  const month = shifted < 10 ? shifted + 3 : shifted - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

/** Parses a strict YYYY-MM-DD date; returns null for anything malformed or not on the calendar. */
export function fromIso(iso: string): number | null {
  const match = ISO_DATE.exec(iso);
  if (match === null) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return fromCivil(y, m, d);
}

/** A day number as YYYY-MM-DD, the format inputs and saved plans use. */
export function toIso(dayNumber: number): string {
  const { year, month, day } = toCivil(dayNumber);
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Day of the week: 0 = Sunday … 6 = Saturday (1970-01-01 was a Thursday). */
export function weekday(dayNumber: number): number {
  return (((dayNumber + 4) % 7) + 7) % 7;
}

/** The same calendar date `years` later; 29 February falls back to 28 in a common year. */
export function addYears(dayNumber: number, years: number): number {
  const { year, month, day } = toCivil(dayNumber);
  return fromCivil(year + years, month, Math.min(day, daysInMonth(year + years, month)));
}

/** Month of a day number, 1 for January to 12 for December. */
export function month(dayNumber: number): number {
  return toCivil(dayNumber).month;
}

/** India Standard Time is a fixed UTC+05:30 with no daylight saving, so arithmetic is exact. */
const IST_OFFSET_MS = 330 * 60_000;
/** A day number times this is that day's UTC midnight in milliseconds. */
export const MS_PER_DAY = 86_400_000;

/** Today in India, so browser and server agree on "today" wherever either runs. */
export function indiaDay(epochMs: number): number {
  return Math.floor((epochMs + IST_OFFSET_MS) / MS_PER_DAY);
}

/** Parses a strict 24-hour HH:MM time into minutes after midnight; null if malformed. */
export function parseTime(hhmm: string): number | null {
  const match = CLOCK_TIME.exec(hhmm);
  if (match === null) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Formats minutes after midnight as HH:MM, wrapping past midnight into the next day's clock. */
export function formatTime(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}
