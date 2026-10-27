/**
 * Field metadata for EventInput: labels, limits, error messages and the structural reader that
 * turns untrusted JSON (a request body, localStorage, a share link) into a typed input.
 */
import { CITY_TIERS, CONSTRAINTS, EVENT_TYPES, SETTINGS } from './ids.ts';
import type { ErrorCode, EventInput, FieldError, InputField } from './types.ts';

/** Bounds from design section 5, exported so the form can mirror them as HTML attributes. */
export const INPUT_LIMITS = {
  invited: { min: 1, max: 5000 },
  budget: { min: 1000, max: 100_000_000 },
  cityMax: 60,
  noteMax: 300,
  maxPriorities: 2,
  /** The event may be up to this many calendar years after today (see addYears). */
  maxLeadYears: 3,
} as const;

/**
 * Limits of an assistant turn, shared by the form, the API schema and the offline parser so the
 * three can never disagree. Capping the message also bounds prompt size and regex work.
 */
export const ASSIST_LIMITS = Object.freeze({
  /** Characters in one user message. */
  message: 500,
  /** Earlier turns sent with a message; the client drops older ones. */
  history: 6,
  /** Characters in one earlier turn: the longest reply the guards let through. */
  turn: 900,
});

/** User-facing field names; the Record type guarantees every field has one. */
export const FIELD_LABELS: Readonly<Record<InputField, string>> = {
  type: 'Event type',
  style: 'Style',
  functions: 'Functions',
  date: 'Date',
  startTime: 'Start time',
  city: 'City',
  tier: 'City size',
  setting: 'Setting',
  venueBooked: 'Venue booked',
  invited: 'Guests invited',
  budget: 'Budget',
  priorities: 'Priorities',
  constraints: 'Needs',
  note: 'Note',
};

/** Every input field in form order; errors are reported in this order. */
export const INPUT_FIELDS = Object.keys(FIELD_LABELS) as readonly InputField[];

const LIMIT_TEXT: Partial<Record<InputField, string>> = {
  invited: 'between 1 and 5,000',
  budget: 'between ₹1,000 and ₹10,00,00,000',
  city: `at most ${String(INPUT_LIMITS.cityMax)} characters`,
  note: `at most ${String(INPUT_LIMITS.noteMax)} characters`,
  priorities: `at most ${String(INPUT_LIMITS.maxPriorities)} choices`,
};

const SPECIFIC: Partial<Record<`${InputField}:${ErrorCode}`, string>> = {
  'city:invalid': 'City may only contain letters, spaces, dots, hyphens and apostrophes.',
  'functions:required': 'A wedding always includes the ceremony.',
  'date:format': 'Enter the date as YYYY-MM-DD.',
  'startTime:format': 'Enter the start time as HH:MM (24-hour).',
};

function generic(label: string, field: InputField, code: ErrorCode): string {
  const limit = LIMIT_TEXT[field] ?? 'within the allowed range';
  const texts: Record<ErrorCode, string> = {
    required: `${label} is required.`,
    invalid: `${label} has a choice that is not available.`,
    format: `${label} is not in the expected format.`,
    'too-long': `${label} must be ${limit}.`,
    'too-many': `${label} must be ${limit}.`,
    'too-small': `${label} must be ${limit}.`,
    'too-large': `${label} must be ${limit}.`,
    'not-whole': `${label} must be a whole number.`,
    past: `${label} cannot be in the past.`,
    'too-far': `${label} must be within three years from today.`,
  };
  return texts[code];
}

/** Builds a field error with its plain-language message. */
export function fieldError(field: InputField, code: ErrorCode): FieldError {
  const message = SPECIFIC[`${field}:${code}`] ?? generic(FIELD_LABELS[field], field, code);
  return { field, code, message };
}

/** Type guard for membership of a closed id list. */
export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Typed input plus the fields whose raw value had the wrong type or an unknown id. */
export interface Shape {
  readonly input: EventInput;
  readonly errors: readonly FieldError[];
}

/**
 * Reads each known field from untrusted data, substituting a neutral placeholder and
 * recording an error when the type is wrong. Unknown keys are never copied, so nothing
 * unvalidated can ride along into the plan.
 */
export function readShape(raw: unknown): Shape {
  const record = isRecord(raw) ? raw : {};
  const errors: FieldError[] = [];
  const take = <T>(field: InputField, ok: (value: unknown) => value is T, fallback: T): T => {
    const value = record[field];
    if (ok(value)) return value;
    errors.push(fieldError(field, value === undefined ? 'required' : 'invalid'));
    return fallback;
  };
  const text = (value: unknown): value is string => typeof value === 'string';
  const number = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const flag = (value: unknown): value is boolean => typeof value === 'boolean';
  const input: EventInput = {
    type: take('type', (v) => isOneOf(EVENT_TYPES, v), 'wedding'),
    style: take('style', text, ''),
    functions: take('functions', isStringList, []),
    date: take('date', text, ''),
    startTime: take('startTime', text, ''),
    city: take('city', text, ''),
    tier: take('tier', (v) => isOneOf(CITY_TIERS, v), 'metro'),
    setting: take('setting', (v) => isOneOf(SETTINGS, v), 'indoor'),
    venueBooked: take('venueBooked', flag, false),
    invited: take('invited', number, 0),
    budget: take('budget', number, 0),
    priorities: take('priorities', isStringList, []),
    constraints: take(
      'constraints',
      (v): v is EventInput['constraints'] =>
        Array.isArray(v) && v.every((item) => isOneOf(CONSTRAINTS, item)),
      [],
    ),
    note: take('note', text, ''),
  };
  return { input, errors };
}
