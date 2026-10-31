/** Normalisation, validation and patching of EventInput: one definition of a valid event. */
import { checkInput, hasValidChoices } from './checks.ts';
import { INPUT_FIELDS, isOneOf, isRecord, readShape } from './fields.ts';
import { PATCH_FIELDS } from './ids.ts';
import type {
  DraftInput,
  EventInput,
  FieldError,
  InputField,
  InputResult,
  PatchField,
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

/** The free-text fields and needs every input has, tidied. */
function cleanShared(input: DraftInput): Pick<EventInput, TidiedField> {
  return {
    date: cleanText(input.date),
    startTime: cleanText(input.startTime),
    city: cleanText(input.city),
    constraints: cleanList(input.constraints),
    note: cleanText(input.note),
  };
}

type TidiedField = 'date' | 'startTime' | 'city' | 'constraints' | 'note';

/**
 * Tidies text and lists without changing meaning; never clamps a number or drops a choice.
 * Choice ids hold no spaces or invisible characters, so only their lists need sorting.
 */
export function normaliseInput(input: EventInput): EventInput {
  return {
    ...input,
    ...cleanShared(input),
    functions: input.type === 'wedding' ? cleanList(input.functions) : [],
    priorities: cleanList(input.priorities),
  };
}

/** Like normaliseInput, but also tidies the choice text, which is still unchecked here. */
function normaliseDraft(input: DraftInput): DraftInput {
  return {
    ...input,
    ...cleanShared(input),
    style: cleanText(input.style),
    functions: input.type === 'wedding' ? cleanList(input.functions.map(cleanText)) : [],
    priorities: cleanList(input.priorities.map(cleanText)),
  };
}

function byFieldOrder(a: FieldError, b: FieldError): number {
  const index = (error: FieldError): number =>
    INPUT_FIELDS.findIndex((field) => field === error.field);
  return index(a) - index(b);
}

/** Validates untrusted data: the normalised input or every field error. */
export function validateInput(raw: unknown, today: number): InputResult {
  const shape = readShape(raw);
  const input = normaliseDraft(shape.input);
  const skip = new Set<string>(shape.errors.map((error) => error.field));
  if (skip.has('type')) TYPE_DEPENDENT.forEach((field) => skip.add(field));
  const errors = [...shape.errors, ...checkInput(input, today, skip)].sort(byFieldOrder);
  return errors.length === 0 && hasValidChoices(input)
    ? { ok: true, value: input }
    : { ok: false, errors };
}

/** Merges a patch into an input and normalises the result; validation is the caller's job. */
export function applyPatch(input: EventInput, patch: PlanPatch): EventInput {
  return normaliseInput({ ...input, ...patch });
}

/** Whether a key names a field a patch may change. */
export function isPatchField(key: string): key is PatchField {
  return isOneOf(PATCH_FIELDS, key);
}

/** The fields of a well-formed patch, in its own key order, or null when it is malformed. */
function patchFields(raw: Readonly<Record<string, unknown>>): PatchField[] | null {
  const keys = Object.keys(raw);
  const fields = keys.filter(isPatchField);
  return keys.length > 0 && fields.length === keys.length ? fields : null;
}

/** The given fields of a validated input, as the patch that sets them. */
function pickPatch(value: EventInput, fields: readonly PatchField[]): PlanPatch {
  const patch: { -readonly [K in PatchField]?: EventInput[K] } = {};
  const set = <K extends PatchField>(field: K, fieldValue: EventInput[K]): void => {
    patch[field] = fieldValue;
  };
  for (const field of fields) set(field, value[field]);
  return patch;
}

function malformedPatch(): PatchResult {
  return {
    ok: false,
    errors: [{ field: 'patch', code: 'invalid', message: 'The proposed change is not valid.' }],
  };
}

/** Validates an untrusted patch, so a model never proposes a change the form would reject. */
export function validatePatch(raw: unknown, base: EventInput, today: number): PatchResult {
  if (!isRecord(raw)) return malformedPatch();
  const fields = patchFields(raw);
  if (fields === null) return malformedPatch();
  const result = validateInput({ ...base, ...raw }, today);
  if (!result.ok) return result;
  return { ok: true, patch: pickPatch(result.value, fields), value: result.value };
}

/** Stable key, equal for inputs that normalise alike; keys the plan memo and response cache. */
export function canonicalKey(input: EventInput): string {
  const clean = normaliseInput(input);
  return JSON.stringify(INPUT_FIELDS.map((field) => clean[field]));
}
