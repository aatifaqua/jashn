/** Normalisation, validation and patching of EventInput: one definition of a valid event. */
import { checkInput } from './checks.ts';
import { INPUT_FIELDS, readShape } from './fields.ts';
import { PATCH_FIELDS } from './ids.ts';
import type {
  EventInput,
  FieldError,
  InputField,
  InputResult,
  PatchResult,
  PlanPatch,
} from './types.ts';

/** Control and invisible format characters; the zero-width joiner stays for emoji sequences. */
const INVISIBLE = /(?!‍)[\p{Cc}\p{Cf}]/gu;
const WHITESPACE = /\s+/gu;

const TYPE_DEPENDENT: readonly InputField[] = ['style', 'functions', 'priorities'];

/** NFC as well, so "café" typed composed or decomposed compares and caches as equal. */
function cleanText(value: string): string {
  return value
    .normalize('NFC')
    .replace(WHITESPACE, ' ')
    .replace(INVISIBLE, '')
    .replace(WHITESPACE, ' ')
    .trim();
}

/** De-duplicated and sorted, so equal choices in any order compare and cache as equal. */
function cleanList<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

/** Tidies text and lists without changing meaning; never clamps a number or drops a choice. */
export function normaliseInput(input: EventInput): EventInput {
  return {
    ...input,
    style: cleanText(input.style),
    functions: input.type === 'wedding' ? cleanList(input.functions.map(cleanText)) : [],
    date: cleanText(input.date),
    startTime: cleanText(input.startTime),
    city: cleanText(input.city),
    priorities: cleanList(input.priorities.map(cleanText)),
    constraints: cleanList(input.constraints),
    note: cleanText(input.note),
  };
}

function byFieldOrder(a: FieldError, b: FieldError): number {
  const index = (error: FieldError): number => INPUT_FIELDS.indexOf(error.field as InputField);
  return index(a) - index(b);
}

/** Validates untrusted data (design 5): the normalised input or every field error. */
export function validateInput(raw: unknown, today: number): InputResult {
  const shape = readShape(raw);
  const input = normaliseInput(shape.input);
  const skip = new Set<string>(shape.errors.map((error) => error.field));
  if (skip.has('type')) TYPE_DEPENDENT.forEach((field) => skip.add(field));
  const errors = [...shape.errors, ...checkInput(input, today, skip)].sort(byFieldOrder);
  return errors.length === 0 ? { ok: true, value: input } : { ok: false, errors };
}

/** Merges a patch into an input and normalises the result; validation is the caller's job. */
export function applyPatch(input: EventInput, patch: PlanPatch): EventInput {
  return normaliseInput({ ...input, ...patch });
}

function isPatchShape(raw: unknown): raw is Readonly<Record<string, unknown>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
  const keys = Object.keys(raw);
  return keys.length > 0 && keys.every((key) => (PATCH_FIELDS as readonly string[]).includes(key));
}

/** Validates an untrusted patch, so a model never proposes a change the form would reject. */
export function validatePatch(raw: unknown, base: EventInput, today: number): PatchResult {
  if (!isPatchShape(raw)) {
    return {
      ok: false,
      errors: [{ field: 'patch', code: 'invalid', message: 'The proposed change is not valid.' }],
    };
  }
  const result = validateInput({ ...base, ...raw }, today);
  if (!result.ok) return result;
  const patch = Object.fromEntries(
    Object.keys(raw).map((key) => [key, result.value[key as InputField]]),
  ) as PlanPatch;
  return { ok: true, patch, value: result.value };
}

/** Stable key, equal for inputs that normalise alike; keys the plan memo and response cache. */
export function canonicalKey(input: EventInput): string {
  const clean = normaliseInput(input);
  return JSON.stringify(INPUT_FIELDS.map((field) => clean[field]));
}
