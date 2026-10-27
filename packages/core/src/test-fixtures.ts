/** Shared test fixtures; imported only by *.test.ts files and excluded from coverage. */
import type { EventInput } from './types.ts';

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
