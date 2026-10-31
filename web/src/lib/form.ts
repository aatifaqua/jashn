/**
 * The intake form's editable state. Numbers are kept as the text the user typed, so "16,00,000"
 * and a half-typed value survive editing; the core validator reads the converted values and
 * owns every rule, so the form never re-implements one.
 */
import type {
  CityTier,
  Constraint,
  EventInput,
  EventType,
  FieldError,
  InputField,
  Profile,
  Setting,
  StyleDef,
} from '@jashn/core';

/** What the form fields are bound to; guests and budget stay text until validated. */
export interface FormState {
  type: EventType;
  style: string;
  functions: string[];
  date: string;
  startTime: string;
  city: string;
  tier: CityTier;
  setting: Setting;
  venueBooked: boolean;
  invited: string;
  budget: string;
  priorities: string[];
  constraints: Constraint[];
  note: string;
}

/** Digit grouping, spaces and the rupee sign people type around amounts. */
const AMOUNT_NOISE = /[\s,₹]/g;

/** A fresh form: a traditional wedding with only the ceremony, nothing else assumed. */
export function blankForm(): FormState {
  return {
    type: 'wedding',
    style: 'traditional',
    functions: ['ceremony'],
    date: '',
    startTime: '18:00',
    city: '',
    tier: 'metro',
    setting: 'indoor',
    venueBooked: false,
    invited: '',
    budget: '',
    priorities: [],
    constraints: [],
    note: '',
  };
}

/** The form filled from a saved or sample input, for editing. */
export function formFrom(input: EventInput): FormState {
  return {
    ...input,
    functions: [...input.functions],
    invited: String(input.invited),
    budget: String(input.budget),
    priorities: [...input.priorities],
    constraints: [...input.constraints],
  };
}

/** Typed text as a number; empty stays undefined so the validator reports "required". */
function amount(text: string): number | undefined {
  const clean = text.replace(AMOUNT_NOISE, '');
  return clean === '' ? undefined : Number(clean);
}

/** The form as untrusted raw input for validateInput. */
export function formToRaw(form: FormState): Record<string, unknown> {
  return { ...form, invited: amount(form.invited), budget: amount(form.budget) };
}

/**
 * The form after choosing an event type: the type's first style and its default start time,
 * the ceremony for weddings, and only the priorities that type has.
 */
export function withType(form: FormState, profile: Profile): FormState {
  const style = profile.styles[0];
  const categories = new Set<string>(profile.categories.map((category) => category.id));
  return {
    ...form,
    type: profile.type,
    style: style?.id ?? '',
    startTime: style?.startTime ?? form.startTime,
    functions: profile.type === 'wedding' ? ['ceremony'] : [],
    priorities: form.priorities.filter((id) => categories.has(id)),
  };
}

/** The form after choosing a style: its default start time comes with it. */
export function withStyle(form: FormState, style: StyleDef): FormState {
  return { ...form, style: style.id, startTime: style.startTime };
}

/** Field errors keyed by field, as the form components receive them. */
export type FieldErrors = Partial<Record<InputField, string>>;

/**
 * The aria-describedby value for a field: its hint (when it has one) and its error (when
 * present), so screen readers announce both with the control.
 */
export function describedBy(
  field: InputField,
  errors: FieldErrors,
  hint = false,
): string | undefined {
  const ids = [hint ? `${field}-hint` : '', errors[field] === undefined ? '' : `${field}-error`];
  const value = ids.filter((id) => id !== '').join(' ');
  return value === '' ? undefined : value;
}

/** The first error message per field, for inline display. */
export function errorsByField(errors: readonly FieldError[]): FieldErrors {
  const out: FieldErrors = {};
  for (const error of errors) {
    if (error.field !== 'patch') out[error.field] ??= error.message;
  }
  return out;
}
