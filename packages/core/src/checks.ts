/** Value rules for a structurally sound, normalised EventInput (design section 5). */
import { addYears, fromIso, parseTime } from './days.ts';
import { INPUT_FIELDS, INPUT_LIMITS, fieldError, isOneOf } from './fields.ts';
import { CATEGORY_IDS, STYLE_IDS, WEDDING_FUNCTIONS } from './ids.ts';
import type { ErrorCode, EventInput, FieldError, InputField } from './types.ts';

/** Letters in any script plus spaces, dots, hyphens and apostrophes. */
const CITY_PATTERN = /^[\p{L}\p{M} .'-]*$/u;

type Check = (input: EventInput, today: number) => ErrorCode | null;

function wholeInRange(value: number, range: { min: number; max: number }): ErrorCode | null {
  if (!Number.isInteger(value)) return 'not-whole';
  if (value < range.min) return 'too-small';
  return value > range.max ? 'too-large' : null;
}

function checkDate(input: EventInput, today: number): ErrorCode | null {
  const day = fromIso(input.date);
  if (day === null) return 'format';
  if (day < today) return 'past';
  return day > addYears(today, INPUT_LIMITS.maxLeadYears) ? 'too-far' : null;
}

function checkFunctions(input: EventInput): ErrorCode | null {
  if (input.type !== 'wedding') return null;
  if (!input.functions.every((id) => isOneOf(WEDDING_FUNCTIONS, id))) return 'invalid';
  return input.functions.includes('ceremony') ? null : 'required';
}

function checkPriorities(input: EventInput): ErrorCode | null {
  if (input.priorities.length > INPUT_LIMITS.maxPriorities) return 'too-many';
  const allowed = CATEGORY_IDS[input.type];
  return input.priorities.every((id) => isOneOf(allowed, id)) ? null : 'invalid';
}

function checkCity(input: EventInput): ErrorCode | null {
  if (input.city.length > INPUT_LIMITS.cityMax) return 'too-long';
  return CITY_PATTERN.test(input.city) ? null : 'invalid';
}

/** Fields not listed here (enums, the flag, constraints) are fully checked by readShape. */
const CHECKS: Partial<Record<InputField, Check>> = {
  style: (input) => (isOneOf(STYLE_IDS[input.type], input.style) ? null : 'invalid'),
  functions: checkFunctions,
  date: checkDate,
  startTime: (input) => (parseTime(input.startTime) === null ? 'format' : null),
  city: checkCity,
  invited: (input) => wholeInRange(input.invited, INPUT_LIMITS.invited),
  budget: (input) => wholeInRange(input.budget, INPUT_LIMITS.budget),
  priorities: checkPriorities,
  note: (input) => (input.note.length > INPUT_LIMITS.noteMax ? 'too-long' : null),
};

/**
 * Runs every value rule except on fields in `skip` (those already failed structurally), in
 * form order so the error summary reads top to bottom.
 */
export function checkInput(
  input: EventInput,
  today: number,
  skip: ReadonlySet<string>,
): FieldError[] {
  const errors: FieldError[] = [];
  for (const field of INPUT_FIELDS) {
    const check = CHECKS[field];
    const code = check === undefined || skip.has(field) ? null : check(input, today);
    if (code !== null) errors.push(fieldError(field, code));
  }
  return errors;
}
