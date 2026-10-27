/** Shared test fixtures; imported only by *.test.ts files and excluded from coverage. */
import fc from 'fast-check';
import { fromCivil, toIso } from './days.ts';
import { INPUT_LIMITS } from './fields.ts';
import {
  CATEGORY_IDS,
  CITY_TIERS,
  CONSTRAINTS,
  EVENT_TYPES,
  LANGUAGES,
  SETTINGS,
  STYLE_IDS,
  WEDDING_FUNCTIONS,
} from './ids.ts';
import type { EventInput, EventType } from './types.ts';

/** A fixed "today" (2026-10-27) so tests never depend on the clock. */
export const TODAY = 20_753;

/** A valid traditional wedding about four months after TODAY, with optional overrides. */
export function sampleInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    type: 'wedding',
    style: 'traditional',
    functions: ['ceremony', 'mehndi', 'reception'],
    date: '2027-02-20',
    startTime: '18:00',
    city: 'Lucknow',
    tier: 'tier2',
    setting: 'indoor',
    venueBooked: false,
    invited: 300,
    budget: 2_500_000,
    priorities: ['catering'],
    constraints: [],
    note: '',
    language: 'en',
    ...overrides,
  };
}

/** Days from 2026-01-01 to the end of 2027, so generated "todays" cover every season. */
const FIRST_TODAY = fromCivil(2026, 1, 1);
const LAST_TODAY = fromCivil(2027, 12, 31);

/** A valid "today" anywhere in two calendar years. */
export const todayArb = fc.integer({ min: FIRST_TODAY, max: LAST_TODAY });

const clock = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

const city = fc.constantFrom('', 'Lucknow', 'Navi Mumbai', "Dal'more", 'नई दिल्ली', 'Bengaluru');

/** Fields of a valid input that do not depend on the event type or on today. */
const common = fc.record({
  startTime: clock,
  city,
  tier: fc.constantFrom(...CITY_TIERS),
  setting: fc.constantFrom(...SETTINGS),
  venueBooked: fc.boolean(),
  invited: fc.integer({ min: INPUT_LIMITS.invited.min, max: INPUT_LIMITS.invited.max }),
  budget: fc.integer({ min: INPUT_LIMITS.budget.min, max: INPUT_LIMITS.budget.max }),
  constraints: fc.subarray([...CONSTRAINTS]),
  note: fc.string({ maxLength: 40 }),
  language: fc.constantFrom(...LANGUAGES),
});

/** Type-dependent fields of a valid input: style, functions and priorities. */
function typed(
  type: EventType,
): fc.Arbitrary<Pick<EventInput, 'style' | 'functions' | 'priorities'>> {
  const others = WEDDING_FUNCTIONS.filter((id) => id !== 'ceremony');
  return fc.record({
    style: fc.constantFrom(...STYLE_IDS[type]),
    functions:
      type === 'wedding'
        ? fc.subarray(others).map((ids): string[] => ['ceremony', ...ids])
        : fc.constant([]),
    priorities: fc.subarray([...CATEGORY_IDS[type]], { maxLength: 2 }),
  });
}

/** A valid input of the given type for an event up to three years after `today`. */
export function inputArb(type: EventType, today: number): fc.Arbitrary<EventInput> {
  return fc
    .tuple(common, typed(type), fc.integer({ min: 0, max: INPUT_LIMITS.maxLeadDays }))
    .map(([shared, own, lead]) => ({ type, ...shared, ...own, date: toIso(today + lead) }));
}

/** A valid input of any type with the today it is valid for. */
export const caseArb: fc.Arbitrary<{ readonly today: number; readonly input: EventInput }> = fc
  .tuple(todayArb, fc.constantFrom(...EVENT_TYPES))
  .chain(([today, type]) => inputArb(type, today).map((input) => ({ today, input })));
