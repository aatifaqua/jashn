/** A small hand-built Plan for the fallback, guard and export tests; imported only by tests. */
import { fromCivil } from '../days.ts';
import { TODAY, sampleInput } from '../test-fixtures.ts';
import type { EventInput, Plan, Task } from '../types.ts';

/** Day number of the sample wedding (2027-02-20). */
export const EVENT_DAY = fromCivil(2027, 2, 20);

/** A task with sensible defaults. */
export function task(overrides: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    due: TODAY + 10,
    idealDue: TODAY + 10,
    phase: 'months-out',
    status: 'upcoming',
    reasons: [{ code: 'base', text: 'Part of every wedding plan.' }],
    ...overrides,
  };
}

const BUDGET: Plan['budget'] = [
  { category: 'venue', amount: 500_000, share: 0.2, reasons: [] },
  {
    category: 'catering',
    amount: 900_000,
    share: 0.36,
    reasons: [],
    perFunction: [
      { functionId: 'ceremony', amount: 400_000 },
      { functionId: 'mehndi', amount: 200_000 },
      { functionId: 'reception', amount: 300_000 },
    ],
  },
];

const FEASIBILITY: Plan['feasibility'] = {
  verdict: 'tight',
  perGuest: 9803.92,
  floor: 3400,
  trims: [
    { id: 'fewer-guests', label: 'Invite fewer guests', saves: 300_000, reasons: [] },
    { id: 'weekday', label: 'Pick a weekday date', saves: 50_000, reasons: [] },
  ],
};

/** A plan for the sample wedding with fixed, easily checked figures. */
export function samplePlan(overrides: Partial<Plan> = {}, input: Partial<EventInput> = {}): Plan {
  const venue = task({
    id: 'book-venue',
    title: 'Book the venue',
    due: TODAY,
    idealDue: TODAY - 12,
    phase: 'do-now',
    status: 'late',
    vendorId: 'venue',
  });
  const caterer = task({ id: 'book-caterer', title: 'Book the caterer', vendorId: 'caterer' });
  return {
    input: sampleInput(input),
    today: TODAY,
    daysToGo: EVENT_DAY - TODAY,
    expected: 255,
    volunteers: 0,
    budget: BUDGET,
    contingency: 250_000,
    feasibility: FEASIBILITY,
    tasks: [
      venue,
      caterer,
      task({ id: 'shortlist', title: 'Shortlist dates', status: 'done' }),
      task({ id: 'thank-you', title: 'Send thank-you notes', due: EVENT_DAY + 3, phase: 'after' }),
    ],
    vendors: [
      {
        id: 'caterer',
        label: 'Caterer',
        category: 'catering',
        bookBy: TODAY + 10,
        booked: false,
        depositShare: 0.25,
        questions: ['Can you cook a Jain menu?', 'Do you provide service staff?'],
        reasons: [],
      },
    ],
    payments: [
      { vendorId: 'venue', kind: 'deposit', due: TODAY - 1, amount: 150_000 },
      { vendorId: 'caterer', kind: 'deposit', due: TODAY + 10, amount: 225_000 },
      { vendorId: 'caterer', kind: 'balance', due: EVENT_DAY - 7, amount: 675_000 },
    ],
    runSheet: [
      { day: EVENT_DAY - 1, start: '16:00', end: '20:00', title: 'Mehndi', owner: 'Family' },
      { day: EVENT_DAY, start: '18:00', end: '22:00', title: 'Ceremony', owner: 'Officiant' },
    ],
    topActions: [venue, caterer],
    notices: [],
    ...overrides,
  };
}
