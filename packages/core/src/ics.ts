/**
 * Timeline export as an RFC 5545 calendar: every open task as an all-day event, plus the event
 * itself. Output uses CRLF line endings, TEXT escaping and 75-octet line folding, so it imports
 * cleanly into common calendar apps.
 */
import { MS_PER_DAY, toCivil, toIso } from './days.ts';
import { formatCount, occasion } from './text.ts';
import type { Plan, Task } from './types.ts';

const CRLF = '\r\n';
const MAX_OCTETS = 75;
const NEWLINE = /\r\n|\r|\n/g;
const SPECIAL = /[\\;,]/g;
const UNSAFE_ID = /[^A-Za-z0-9-]/g;

/** Options for an export; the timestamp is passed in so the core never reads the clock. */
export interface IcsOptions {
  /** Creation time for DTSTAMP, in milliseconds since the Unix epoch (UTC). */
  readonly stampMs: number;
  /** Stable id of the saved plan; keeps UIDs distinct between two plans of the same kind. */
  readonly planId?: string;
}

/** Escapes a TEXT value (RFC 5545 section 3.3.11): backslash, semicolon, comma and newlines. */
export function escapeText(text: string): string {
  return text.replace(SPECIAL, (char) => `\\${char}`).replace(NEWLINE, '\\n');
}

/** UTF-8 length of one code point; a two-unit string is an astral character (4 octets). */
function octets(char: string): number {
  if (char.length > 1) return 4;
  const code = char.charCodeAt(0);
  if (code < 0x80) return 1;
  return code < 0x800 ? 2 : 3;
}

/**
 * Folds a content line so no physical line exceeds 75 octets of UTF-8 (RFC 5545 section
 * 3.1). It walks code points, so a multi-byte character is never split across lines.
 */
export function foldLine(line: string): string {
  let folded = '';
  let used = 0;
  for (const char of line) {
    const size = octets(char);
    if (used + size > MAX_OCTETS) {
      folded += `${CRLF} `;
      used = 1;
    }
    folded += char;
    used += size;
  }
  return folded;
}

function basicDate(day: number): string {
  return toIso(day).replaceAll('-', '');
}

/** UTC timestamp in the basic format YYYYMMDDTHHMMSSZ, by integer arithmetic. */
function stamp(ms: number): string {
  const day = Math.floor(ms / MS_PER_DAY);
  const seconds = Math.floor((ms - day * MS_PER_DAY) / 1000);
  const pad = (value: number): string => String(value).padStart(2, '0');
  const time = `${pad(Math.floor(seconds / 3600))}${pad(Math.floor(seconds / 60) % 60)}${pad(seconds % 60)}`;
  const { year, month, day: date } = toCivil(day);
  return `${String(year).padStart(4, '0')}${pad(month)}${pad(date)}T${time}Z`;
}

/** FNV-1a: a tiny, stable string hash, enough to tell plans apart inside UIDs. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

interface CalendarEvent {
  readonly uid: string;
  readonly start: number;
  readonly end: number;
  readonly summary: string;
  readonly description: string;
  readonly busy: boolean;
}

function vevent(event: CalendarEvent, dtstamp: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${basicDate(event.start)}`,
    `DTEND;VALUE=DATE:${basicDate(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `TRANSP:${event.busy ? 'OPAQUE' : 'TRANSPARENT'}`,
    'END:VEVENT',
  ];
}

function mainEvent(plan: Plan, seed: string): CalendarEvent {
  const eventDay = plan.today + plan.daysToGo;
  let first = eventDay;
  let last = eventDay;
  for (const slot of plan.runSheet) {
    first = Math.min(first, slot.day);
    last = Math.max(last, slot.day);
  }
  const name = occasion(plan.input);
  const where = plan.input.city === '' ? '' : ` in ${plan.input.city}`;
  return {
    uid: `event.${seed}@jashn`,
    start: first,
    end: last + 1,
    summary: `${name.charAt(0).toUpperCase()}${name.slice(1)}${where}`,
    description: `Starts at ${plan.input.startTime}. About ${formatCount(plan.expected)} guests expected.`,
    busy: true,
  };
}

function taskEvent(task: Task, seed: string): CalendarEvent {
  return {
    uid: `task.${task.id.replace(UNSAFE_ID, '-')}.${seed}@jashn`,
    start: task.due,
    end: task.due + 1,
    summary: task.title,
    // The timeline's own reasons already say when a late task was ideally due.
    description: task.reasons.map((reason) => reason.text).join('\n'),
    busy: false,
  };
}

/**
 * Builds the .ics text for a plan. UIDs depend on the plan id (or, without one, the event type
 * and city) and the task id but not on the date, so re-importing after a change updates the
 * existing entries instead of duplicating them. Tasks already done are left out.
 */
export function toIcs(plan: Plan, options: IcsOptions): string {
  const seed = (options.planId ?? fnv1a(`${plan.input.type}|${plan.input.city}`)).replace(
    UNSAFE_ID,
    '-',
  );
  const dtstamp = stamp(options.stampMs);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jashn//Event planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevent(mainEvent(plan, seed), dtstamp),
  ];
  for (const task of plan.tasks) {
    if (task.status !== 'done') lines.push(...vevent(taskEvent(task, seed), dtstamp));
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
