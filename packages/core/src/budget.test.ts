import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONTINGENCY,
  allocateBudget,
  apportion,
  contingencyShare,
  planBudget,
} from './budget.ts';
import { deriveContext } from './context.ts';
import { toIso } from './days.ts';
import {
  CATEGORY_IDS,
  CITY_TIERS,
  CONSTRAINTS,
  EVENT_TYPES,
  SETTINGS,
  STYLE_IDS,
  WEDDING_FUNCTIONS,
} from './ids.ts';
import { getProfile } from './profiles/index.ts';
import { fireRules } from './rules.ts';
import type { FiredRule } from './rules.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import type { EventInput } from './types.ts';

function run(input: EventInput) {
  const profile = getProfile(input.type);
  const ctx = deriveContext(input, TODAY, profile);
  return planBudget(input, profile, ctx, fireRules(ctx, input));
}

function amounts(input: EventInput): Record<string, number> {
  return Object.fromEntries(run(input).lines.map((line) => [line.category, line.amount]));
}

describe('apportion', () => {
  const same = (value: number): number => value;

  it('splits by largest remainder and sums exactly', () => {
    const parts = apportion(10, [1, 1, 1], same).map((part) => part.units);
    expect(parts).toEqual([4, 3, 3]);
  });

  it('gives remainders to the largest fractions first', () => {
    expect(apportion(7, [0.5, 2, 1], same).map((part) => part.units)).toEqual([1, 4, 2]);
  });

  it('gives nothing when no weight is positive', () => {
    expect(apportion(5, [0, 0], same).map((part) => part.units)).toEqual([0, 0]);
  });

  it('always sums to the total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.double({ min: 0.01, max: 100, noNaN: true }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          const parts = apportion(total, weights, same);
          expect(parts.reduce((sum, part) => sum + part.units, 0)).toBe(total);
          for (const part of parts) expect(part.units).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

describe('contingencyShare', () => {
  it('defaults to 10 % and takes the largest rule override', () => {
    expect(contingencyShare([])).toBe(DEFAULT_CONTINGENCY);
    const strict: FiredRule = {
      id: 'x',
      reason: { code: 'x', text: 'x' },
      effects: { contingency: 0.15 },
    };
    expect(contingencyShare([strict])).toBe(0.15);
  });
});

describe('allocateBudget', () => {
  it('drops lines and function parts a tiny budget rounds to ₹0', () => {
    const { lines, contingency } = run(sampleInput({ budget: 1000, invited: 2 }));
    for (const line of lines) {
      expect(line.amount).toBeGreaterThan(0);
      for (const part of line.perFunction ?? []) expect(part.amount).toBeGreaterThan(0);
    }
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.reduce((sum, line) => sum + line.amount, contingency)).toBe(1000);
  });

  it('pins the sample wedding', () => {
    const result = run(sampleInput());
    expect(result.contingency).toBe(250_000);
    expect(amounts(sampleInput())).toEqual({
      venue: 399_000,
      catering: 831_300,
      decor: 266_000,
      photography: 177_400,
      attire: 221_700,
      entertainment: 110_800,
      invitations: 44_300,
      gifts: 66_500,
      travel: 88_700,
      bar: 44_300,
    });
  });

  it('explains each line with base, style, rule and priority reasons', () => {
    const lines = run(sampleInput({ constraints: ['eco-friendly'] })).lines;
    const codes = (category: string) =>
      lines.find((line) => line.category === category)?.reasons.map((reason) => reason.code);
    expect(codes('catering')).toEqual(['base', 'priority']);
    expect(codes('decor')).toEqual(['base', 'style', 'eco-friendly']);
    expect(codes('bar')).toEqual(['style']);
    const priority = lines.find((line) => line.category === 'catering')?.reasons[1]?.text;
    expect(priority).toBe('You chose catering as a priority: ×1.25.');
  });

  it('splits catering and decor across wedding functions by guest share', () => {
    const catering = run(sampleInput()).lines.find((line) => line.category === 'catering');
    expect(catering?.perFunction).toEqual([
      { functionId: 'mehndi', amount: 191_900 },
      { functionId: 'ceremony', amount: 319_700 },
      { functionId: 'reception', amount: 319_700 },
    ]);
    const single = run(sampleInput({ functions: ['ceremony'] })).lines;
    expect(single.every((line) => line.perFunction === undefined)).toBe(true);
  });

  it('applies style deltas', () => {
    const traditional = amounts(sampleInput({ priorities: [] }));
    const destination = amounts(sampleInput({ style: 'destination', priorities: [] }));
    expect(destination.travel).toBeGreaterThan(traditional.travel ?? 0);
    const kids = amounts(sampleInput({ type: 'birthday', style: 'kids', functions: [] }));
    const adult = amounts(sampleInput({ type: 'birthday', style: 'adult', functions: [] }));
    expect(kids.bar).toBeUndefined();
    expect(adult.bar).toBeGreaterThan(0);
    expect(kids.entertainment).toBeGreaterThan(adult.entertainment ?? 0);
  });

  it('removes the bar when alcohol-free and moves invitations to decor when eco-friendly', () => {
    const plain = amounts(sampleInput());
    const free = amounts(sampleInput({ constraints: ['alcohol-free'] }));
    expect(free.bar).toBeUndefined();
    const eco = amounts(sampleInput({ constraints: ['eco-friendly'] }));
    expect(eco.invitations).toBeLessThan((plain.invitations ?? 0) * 0.25);
    expect(eco.decor).toBeGreaterThan(plain.decor ?? 0);
  });

  it('adds monsoon cover to decor or infrastructure', () => {
    const dry = amounts(sampleInput({ setting: 'outdoor', priorities: [] }));
    const wet = amounts(sampleInput({ setting: 'outdoor', priorities: [], date: '2027-07-10' }));
    expect(wet.decor).toBeGreaterThan(dry.decor ?? 0);
    const fest = { type: 'community', style: 'festival', functions: [], priorities: [] } as const;
    const fair = amounts(sampleInput({ ...fest, setting: 'outdoor' }));
    const rain = amounts(sampleInput({ ...fest, setting: 'outdoor', date: '2027-07-10' }));
    expect(rain.infrastructure).toBeGreaterThan(fair.infrastructure ?? 0);
  });

  it('adds to entertainment or programme when kid-friendly', () => {
    const party = { type: 'birthday', style: 'adult', functions: [], priorities: [] } as const;
    const plain = amounts(sampleInput(party));
    const kind = amounts(sampleInput({ ...party, constraints: ['kid-friendly'] }));
    expect(kind.entertainment).toBeGreaterThan(plain.entertainment ?? 0);
    const meet = { type: 'community', style: 'meetup', functions: [], priorities: [] } as const;
    const kids = amounts(sampleInput({ ...meet, constraints: ['kid-friendly'] }));
    expect(kids.programme).toBeGreaterThan(amounts(sampleInput(meet)).programme ?? 0);
  });

  it('holds 15 % under budget-strict', () => {
    expect(run(sampleInput({ constraints: ['budget-strict'] })).contingency).toBe(375_000);
  });

  it('keeps the odd rupees in the contingency', () => {
    const result = run(sampleInput({ budget: 123_456 }));
    expect(result.contingency).toBe(12_356);
    const total = result.lines.reduce((sum, line) => sum + line.amount, result.contingency);
    expect(total).toBe(123_456);
  });

  it('ignores unknown styles, priorities and missing move targets', () => {
    const profile = getProfile('community');
    const input = sampleInput({
      type: 'community',
      style: 'unknown',
      functions: [],
      priorities: ['catering'],
      constraints: ['eco-friendly'],
    });
    const ctx = deriveContext(input, TODAY, profile);
    const result = allocateBudget(input, profile, fireRules(ctx, input));
    expect(result.lines.map((line) => line.reasons.map((reason) => reason.code))).toEqual(
      Array.from({ length: 8 }, () => ['base']),
    );
  });
});

const validInput: fc.Arbitrary<EventInput> = fc.constantFrom(...EVENT_TYPES).chain((type) =>
  fc.record({
    type: fc.constant(type),
    style: fc.constantFrom(...STYLE_IDS[type]),
    functions:
      type === 'wedding'
        ? fc
            .subarray(WEDDING_FUNCTIONS.filter((id) => id !== 'ceremony'))
            .map((ids) => ['ceremony', ...ids])
        : fc.constant([]),
    date: fc.integer({ min: 0, max: 1096 }).map((offset) => toIso(TODAY + offset)),
    startTime: fc.constantFrom('07:00', '11:30', '16:00', '18:00', '21:45'),
    city: fc.constant('Pune'),
    tier: fc.constantFrom(...CITY_TIERS),
    setting: fc.constantFrom(...SETTINGS),
    venueBooked: fc.boolean(),
    invited: fc.integer({ min: 1, max: 5000 }),
    budget: fc.integer({ min: 1000, max: 100_000_000 }),
    priorities: fc.subarray([...CATEGORY_IDS[type]], { maxLength: 2 }),
    constraints: fc.subarray([...CONSTRAINTS]),
    note: fc.constant(''),
    language: fc.constant('en' as const),
  }),
);

describe('planBudget invariants', () => {
  it('lines plus contingency equal the budget exactly, in ₹100 lines', () => {
    fc.assert(
      fc.property(validInput, (input) => {
        const { lines, contingency, feasibility } = run(input);
        const total = lines.reduce((sum, line) => sum + line.amount, contingency);
        expect(total).toBe(input.budget);
        const reserve = input.constraints.includes('budget-strict') ? 0.15 : 0.1;
        expect(contingency).toBeGreaterThanOrEqual(Math.floor(input.budget * reserve));
        expect(contingency).toBeLessThan(input.budget * reserve + 100);
        for (const line of lines) {
          expect(line.amount % 100).toBe(0);
          expect(line.reasons.length).toBeGreaterThan(0);
          const split = line.perFunction?.reduce((sum, part) => sum + part.amount, 0);
          if (split !== undefined) expect(split).toBe(line.amount);
        }
        const saves = feasibility.trims.map((trim) => trim.saves);
        expect(saves).toEqual([...saves].sort((a, b) => b - a));
      }),
    );
  });
});
