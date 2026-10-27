import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromIso, toIso } from './days.ts';
import { INPUT_FIELDS, INPUT_LIMITS } from './fields.ts';
import { CATEGORY_IDS, CONSTRAINTS, STYLE_IDS } from './ids.ts';
import { applyPatch, canonicalKey, normaliseInput, validateInput, validatePatch } from './input.ts';
import { TODAY, maxLead, sampleInput } from './test-fixtures.ts';
import type { EventInput, FieldError, PlanPatch } from './types.ts';

function errorsOf(raw: unknown): readonly FieldError[] {
  const result = validateInput(raw, TODAY);
  return result.ok ? [] : result.errors;
}

function codes(raw: unknown): string[] {
  return errorsOf(raw).map((error) => `${error.field}:${error.code}`);
}

describe('fixtures', () => {
  it('pins TODAY to 2026-10-27', () => {
    expect(TODAY).toBe(fromIso('2026-10-27'));
  });
});

describe('normaliseInput', () => {
  it('cleans text without changing meaning', () => {
    const clean = normaliseInput(
      sampleInput({ city: '  New​  Delhi\t', note: 'veg‮ food\n\nplease ', date: ' 2027-02-20 ' }),
    );
    expect(clean.city).toBe('New Delhi');
    expect(clean.note).toBe('veg food please');
    expect(clean.date).toBe('2027-02-20');
  });

  it('keeps joiners that emoji and Devanagari need, and composes text to NFC', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467} family';
    const marathi = 'कार्‍यक्रम';
    const clean = normaliseInput(sampleInput({ note: family, city: marathi }));
    expect(clean.note).toBe(family);
    expect(clean.city).toBe(marathi);
    const decomposed = normaliseInput(sampleInput({ city: 'Bandra Café' }));
    expect(decomposed.city).toBe('Bandra Café');
  });

  it('de-duplicates and sorts lists', () => {
    const clean = normaliseInput(
      sampleInput({
        functions: ['reception', 'ceremony', 'reception'],
        priorities: ['decor', 'catering', 'decor'],
        constraints: ['vegetarian', 'jain', 'vegetarian'],
      }),
    );
    expect(clean.functions).toEqual(['ceremony', 'reception']);
    expect(clean.priorities).toEqual(['catering', 'decor']);
    expect(clean.constraints).toEqual(['jain', 'vegetarian']);
  });

  it('empties functions for non-weddings and leaves numbers alone', () => {
    const clean = normaliseInput(
      sampleInput({ type: 'birthday', functions: ['ceremony'], invited: 2.5 }),
    );
    expect(clean.functions).toEqual([]);
    expect(clean.invited).toBe(2.5);
  });
});

describe('validateInput', () => {
  it('accepts a valid input and returns it normalised', () => {
    const result = validateInput({ ...sampleInput(), city: ' Lucknow ', extra: 'ignored' }, TODAY);
    expect(result).toEqual({ ok: true, value: sampleInput() });
  });

  it('allows exactly three calendar years ahead when no leap day falls in the window', () => {
    const today = fromIso('2028-03-01') ?? 0;
    expect(validateInput(sampleInput({ date: '2031-03-01' }), today).ok).toBe(true);
    expect(validateInput(sampleInput({ date: '2031-03-02' }), today).ok).toBe(false);
  });

  it('accepts the boundaries', () => {
    const edges = sampleInput({
      date: toIso(TODAY + maxLead(TODAY)),
      invited: INPUT_LIMITS.invited.max,
      budget: INPUT_LIMITS.budget.min,
      city: '',
      note: 'x'.repeat(INPUT_LIMITS.noteMax),
      priorities: ['venue', 'decor'],
    });
    expect(codes(edges)).toEqual([]);
    expect(codes(sampleInput({ date: toIso(TODAY) }))).toEqual([]);
  });

  it.each([null, 'text', 42, []])('reports every field as required for %j', (raw) => {
    const errors = errorsOf(raw);
    expect(errors.map((error) => error.field)).toEqual(INPUT_FIELDS);
    expect(errors.every((error) => error.code === 'required')).toBe(true);
  });

  it('flags wrong types as invalid, in form order', () => {
    const raw = {
      ...sampleInput(),
      language: 'fr',
      invited: '300',
      type: 'party',
      venueBooked: 'yes',
      constraints: ['vegan'],
      budget: Number.NaN,
      functions: [1],
    };
    expect(codes(raw)).toEqual([
      'type:invalid',
      'functions:invalid',
      'venueBooked:invalid',
      'invited:invalid',
      'budget:invalid',
      'constraints:invalid',
      'language:invalid',
    ]);
  });

  it('skips type-dependent checks when the type is bad', () => {
    expect(codes({ ...sampleInput({ style: 'kids' }), type: 'party' })).toEqual(['type:invalid']);
  });

  it.each<[Partial<EventInput>, string]>([
    [{ style: 'kids' }, 'style:invalid'],
    [{ functions: ['ceremony', 'baraat'] }, 'functions:invalid'],
    [{ functions: ['mehndi'] }, 'functions:required'],
    [{ date: '20-02-2027' }, 'date:format'],
    [{ date: toIso(TODAY - 1) }, 'date:past'],
    [{ date: toIso(TODAY + maxLead(TODAY) + 1) }, 'date:too-far'],
    [{ startTime: '6pm' }, 'startTime:format'],
    [{ city: 'L'.repeat(61) }, 'city:too-long'],
    [{ city: 'Lucknow 226001' }, 'city:invalid'],
    [{ invited: 0 }, 'invited:too-small'],
    [{ invited: 5001 }, 'invited:too-large'],
    [{ invited: 10.5 }, 'invited:not-whole'],
    [{ budget: 999 }, 'budget:too-small'],
    [{ budget: 100_000_001 }, 'budget:too-large'],
    [{ priorities: ['venue', 'decor', 'catering'] }, 'priorities:too-many'],
    [{ priorities: ['infrastructure'] }, 'priorities:invalid'],
    [{ note: 'x'.repeat(301) }, 'note:too-long'],
  ])('rejects %j with %s', (override, expected) => {
    expect(codes(sampleInput(override))).toEqual([expected]);
  });

  it('accepts cities in any script', () => {
    expect(codes(sampleInput({ city: "लखनऊ St. John's-Wood" }))).toEqual([]);
  });

  it('accepts every style and category of every type', () => {
    for (const type of ['wedding', 'birthday', 'community'] as const) {
      for (const style of STYLE_IDS[type]) {
        const priorities = CATEGORY_IDS[type].slice(0, 2);
        expect(codes(sampleInput({ type, style, priorities }))).toEqual([]);
      }
    }
  });

  it('writes a plain-language message for each error', () => {
    const messages = [
      ...errorsOf(sampleInput({ city: 'Lucknow 1', invited: 0, date: 'soon' })),
      ...errorsOf(sampleInput({ functions: ['mehndi'], note: 'x'.repeat(400) })),
      ...errorsOf({ ...sampleInput(), tier: 'city' }),
    ].map((error) => error.message);
    expect(messages).toEqual([
      'Enter the date as YYYY-MM-DD.',
      'City may only contain letters, spaces, dots, hyphens and apostrophes.',
      'Guests invited must be between 1 and 5,000.',
      'A wedding always includes the ceremony.',
      'Note must be at most 300 characters.',
      'City size has a choice that is not available.',
    ]);
  });
});

describe('validatePatch', () => {
  const base = sampleInput();

  it.each([null, [], {}, { invited: 200, type: 'birthday' }, { note: 'hi' }])(
    'rejects the malformed patch %j',
    (raw) => {
      expect(validatePatch(raw, base, TODAY)).toEqual({
        ok: false,
        errors: [{ field: 'patch', code: 'invalid', message: 'The proposed change is not valid.' }],
      });
    },
  );

  it('returns field errors when the patched input is invalid', () => {
    const result = validatePatch({ invited: 0, style: 'kids' }, base, TODAY);
    expect(result.ok ? [] : result.errors.map((error) => error.field)).toEqual([
      'style',
      'invited',
    ]);
  });

  it('returns the normalised patch and the patched input', () => {
    const result = validatePatch(
      { invited: 180, constraints: ['vegetarian', 'jain', 'jain'] },
      base,
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      patch: { invited: 180, constraints: ['jain', 'vegetarian'] },
      value: { ...base, invited: 180, constraints: ['jain', 'vegetarian'] },
    });
  });
});

const validPatch: fc.Arbitrary<PlanPatch> = fc.record(
  {
    date: fc.integer({ min: TODAY, max: TODAY + maxLead(TODAY) }).map(toIso),
    startTime: fc
      .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
      .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
    invited: fc.integer({ min: 1, max: 5000 }),
    budget: fc.integer({ min: 1000, max: 100_000_000 }),
    priorities: fc.subarray([...CATEGORY_IDS.wedding], { maxLength: 2 }),
    constraints: fc.subarray([...CONSTRAINTS]),
    setting: fc.constantFrom('indoor', 'outdoor', 'mixed'),
    tier: fc.constantFrom('metro', 'tier2', 'town'),
    functions: fc
      .subarray(['haldi', 'mehndi', 'sangeet', 'reception'])
      .map((list) => ['ceremony', ...list]),
    style: fc.constantFrom(...STYLE_IDS.wedding),
  },
  { requiredKeys: [] },
);

describe('applyPatch', () => {
  it('merges and normalises', () => {
    const patched = applyPatch(sampleInput(), { invited: 180, priorities: ['decor', 'catering'] });
    expect(patched.invited).toBe(180);
    expect(patched.priorities).toEqual(['catering', 'decor']);
  });

  it('always yields a valid input for a valid patch', () => {
    fc.assert(
      fc.property(validPatch, (patch) => {
        expect(validateInput(applyPatch(sampleInput(), patch), TODAY).ok).toBe(true);
      }),
    );
  });
});

describe('canonicalKey', () => {
  it('ignores key order, list order and stray whitespace', () => {
    const a = sampleInput({ constraints: ['jain', 'vegetarian'], city: 'Lucknow' });
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as EventInput;
    const b = { ...reordered, constraints: ['vegetarian', 'jain'], city: ' Lucknow ' } as const;
    expect(canonicalKey(b)).toBe(canonicalKey(a));
  });

  it('differs when any field differs', () => {
    expect(canonicalKey(sampleInput({ invited: 301 }))).not.toBe(canonicalKey(sampleInput()));
  });
});
