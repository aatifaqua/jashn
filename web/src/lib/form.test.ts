import { validateInput } from '@jashn/core';
import { getProfile } from '@jashn/core/server';
import { describe, expect, it } from 'vitest';
import { TODAY, sampleInput } from '../test-fixtures.ts';
import {
  blankForm,
  describedBy,
  errorsByField,
  formFrom,
  formToRaw,
  withStyle,
  withType,
} from './form.ts';

describe('form state', () => {
  it('round-trips an input through the form', () => {
    const input = sampleInput();
    expect(validateInput(formToRaw(formFrom(input)), TODAY)).toEqual({ ok: true, value: input });
  });

  it('reads typed amounts with grouping and leaves blanks for the validator', () => {
    const form = { ...blankForm(), invited: ' 1,200 ', budget: '₹16,00,000' };
    expect(formToRaw(form)).toMatchObject({ invited: 1200, budget: 1_600_000 });
    expect(formToRaw(blankForm())).toMatchObject({ invited: undefined, budget: undefined });
    expect(formToRaw({ ...blankForm(), invited: 'many' }).invited).toBeNaN();
  });

  it('resets type-specific choices when the type changes', () => {
    const wedding = { ...blankForm(), priorities: ['catering', 'decor'] };
    const birthday = withType(wedding, getProfile('birthday'));
    expect(birthday).toMatchObject({
      type: 'birthday',
      style: 'kids',
      functions: [],
      priorities: ['decor'],
    });
    expect(birthday.startTime).toBe(getProfile('birthday').styles[0]?.startTime);
    expect(withType(birthday, getProfile('wedding')).functions).toEqual(['ceremony']);
  });

  it('takes the default start time of a chosen style', () => {
    const profile = getProfile('community');
    const meetup = profile.styles.find((s) => s.id === 'meetup');
    if (meetup === undefined) throw new Error('profile changed');
    const form = withStyle(withType(blankForm(), profile), meetup);
    expect(form.style).toBe('meetup');
    expect(form.startTime).toBe(meetup.startTime);
  });

  it('keeps the current start time for a profile without styles', () => {
    const empty = { ...getProfile('birthday'), styles: [] };
    expect(withType({ ...blankForm(), startTime: '11:00' }, empty)).toMatchObject({
      style: '',
      startTime: '11:00',
    });
  });

  it('maps errors to fields and builds describedby ids', () => {
    const errors = errorsByField([
      { field: 'city', code: 'invalid', message: 'First' },
      { field: 'city', code: 'too-long', message: 'Second' },
      { field: 'patch', code: 'invalid', message: 'Ignored' },
    ]);
    expect(errors).toEqual({ city: 'First' });
    expect(describedBy('city', errors, true)).toBe('city-hint city-error');
    expect(describedBy('city', errors)).toBe('city-error');
    expect(describedBy('date', errors, true)).toBe('date-hint');
    expect(describedBy('date', errors)).toBeUndefined();
  });
});
