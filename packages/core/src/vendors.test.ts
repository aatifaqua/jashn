import { describe, expect, it } from 'vitest';
import { TODAY, sampleInput } from './test-fixtures.ts';
import type { FiredRule } from './rules.ts';
import type { StageInput } from './timeline.ts';
import type { BudgetLine, EventContext, Profile, RuleEffects, Task, VendorItem } from './types.ts';
import { buildPayments, buildVendors } from './vendors.ts';

const EVENT = TODAY + 100;

const CTX: EventContext = {
  today: TODAY,
  eventDay: EVENT,
  daysToGo: 100,
  weekday: 6,
  midweek: false,
  month: 2,
  season: { peakWedding: true, monsoon: false, summer: false },
  spanDays: 2,
  expected: 255,
  startMinutes: 1080,
  flags: { outdoor: false, largeCrowd: true, publicGathering: false, shortNotice: false },
};

const PROFILE: Profile = {
  type: 'wedding',
  label: 'Wedding',
  styles: [],
  functions: [],
  categories: [
    { id: 'venue', label: 'Venue', weight: 18 },
    { id: 'attire', label: 'Attire & beauty', weight: 10 },
  ],
  turnout: 0.85,
  floors: { metro: 3000, tier2: 2000, town: 1200 },
  minLeadDays: 60,
  tasks: [],
  vendors: [
    {
      id: 'venue',
      label: 'Venue',
      category: 'venue',
      taskId: 'book-venue',
      depositShare: 0.3,
      questions: ['Capacity?'],
    },
    {
      id: 'mehndi-artist',
      label: 'Mehndi artist',
      category: 'attire',
      taskId: 'book-mehndi',
      depositShare: 0.2,
      questions: ['Organic henna?'],
      appliesWhen: { functions: ['mehndi'] },
    },
    {
      id: 'makeup-artist',
      label: 'Make-up artist',
      category: 'attire',
      taskId: 'book-makeup',
      depositShare: 0.2,
      questions: [],
    },
    {
      id: 'bartender',
      label: 'Bartender',
      category: 'bar',
      taskId: 'book-bar',
      depositShare: 0.2,
      questions: [],
    },
  ],
};

function rule(id: string, effects: RuleEffects): FiredRule {
  return { id, reason: { code: id, text: `Because of ${id}.` }, effects };
}

function stage(
  fired: readonly FiredRule[],
  functions: readonly string[] = ['ceremony', 'mehndi'],
): StageInput {
  return {
    profile: PROFILE,
    ctx: CTX,
    input: sampleInput({ functions }),
    fired,
  };
}

function task(id: string, due: number, status: Task['status'] = 'upcoming'): Task {
  return { id, title: `Task ${id}`, due, idealDue: due, phase: 'months-out', status, reasons: [] };
}

const TASKS = [
  task('book-venue', TODAY, 'done'),
  task('book-mehndi', EVENT - 30),
  task('book-makeup', EVENT - 3),
];

function find(vendors: readonly VendorItem[], id: string): VendorItem {
  const vendor = vendors.find((v) => v.id === id);
  if (vendor === undefined) throw new Error(`missing vendor ${id}`);
  return vendor;
}

describe('buildVendors', () => {
  it('filters by functions and rules, and takes book-by dates from the timeline', () => {
    const vendors = buildVendors(
      stage([rule('alcohol-free', { removeVendors: ['bartender'] })]),
      TASKS,
    );
    expect(vendors.map((v) => [v.id, v.bookBy])).toEqual([
      ['venue', TODAY],
      ['mehndi-artist', EVENT - 30],
      ['makeup-artist', EVENT - 3],
    ]);
    expect(buildVendors(stage([], ['ceremony']), TASKS).map((v) => v.id)).toEqual([
      'venue',
      'makeup-artist',
      'bartender',
    ]);
  });

  it('explains book-by and deposit, falling back to today without a task', () => {
    const vendors = buildVendors(stage([]), TASKS);
    expect(find(vendors, 'venue').reasons.map((r) => r.code)).toEqual(['booked', 'deposit']);
    expect(find(vendors, 'venue')).toMatchObject({ booked: true, bookBy: TODAY });
    expect(find(vendors, 'mehndi-artist').booked).toBe(false);
    expect(find(vendors, 'mehndi-artist').reasons[0]?.text).toContain('"Task book-mehndi"');
    expect(find(vendors, 'mehndi-artist').reasons[1]?.text).toBe(
      'A typical deposit is 20% of the Attire & beauty line, paid on booking.',
    );
    const bar = find(vendors, 'bartender');
    expect(bar.bookBy).toBe(TODAY);
    expect(bar.reasons[0]).toEqual({ code: 'book-by', text: 'Book by 27 Oct 2026.' });
    expect(bar.reasons[1]?.text).toContain('of the bar line');
  });

  it('adds rule questions once, with each rule reason once', () => {
    const veg = rule('vegetarian', {
      questions: [
        { vendorId: 'venue', text: 'Outside caterers allowed?' },
        { vendorId: 'venue', text: 'Capacity?' },
        { vendorId: 'venue', text: 'Separate veg kitchen?' },
      ],
    });
    const ramp = rule('step-free', {
      questions: [{ vendorId: 'venue', text: 'Is there a ramp?' }],
    });
    const venue = find(
      buildVendors(stage([veg, ramp, rule('none', { questions: [] })]), TASKS),
      'venue',
    );
    expect(venue.questions).toEqual([
      'Capacity?',
      'Outside caterers allowed?',
      'Separate veg kitchen?',
      'Is there a ramp?',
    ]);
    expect(venue.reasons.map((r) => r.code)).toEqual([
      'booked',
      'deposit',
      'vegetarian',
      'step-free',
    ]);
  });
});

describe('buildPayments', () => {
  const vendors = buildVendors(stage([]), TASKS);
  const budget: BudgetLine[] = [
    { category: 'venue', amount: 450_000, share: 0.18, reasons: [] },
    { category: 'attire', amount: 250_150, share: 0.1, reasons: [] },
  ];

  it('schedules deposits on book-by and balances a week before, from the budget lines', () => {
    const payments = buildPayments(vendors, budget, EVENT);
    // The venue is booked, so its 30% deposit counts as paid and only the rest is listed.
    expect(payments).toEqual([
      { vendorId: 'mehndi-artist', kind: 'deposit', due: EVENT - 30, amount: 25_000 },
      { vendorId: 'venue', kind: 'balance', due: EVENT - 7, amount: 315_000 },
      { vendorId: 'mehndi-artist', kind: 'balance', due: EVENT - 7, amount: 100_150 },
      { vendorId: 'makeup-artist', kind: 'deposit', due: EVENT - 3, amount: 25_000 },
      { vendorId: 'makeup-artist', kind: 'balance', due: EVENT - 3, amount: 100_000 },
    ]);
    const attire = payments
      .filter((p) => p.vendorId !== 'venue')
      .reduce((sum, p) => sum + p.amount, 0);
    expect(attire).toBe(250_150);
  });

  it('pays vendors with a line share only their part, the rest split among the others', () => {
    const attire = (lineShare?: number): VendorItem => ({
      ...find(vendors, 'makeup-artist'),
      ...(lineShare === undefined ? {} : { lineShare }),
    });
    const paid = (payments: readonly { vendorId: string; amount: number }[], id: string) =>
      payments.filter((p) => p.vendorId === id).reduce((sum, p) => sum + p.amount, 0);
    // Alone on the line a vendor is owed its share, or the whole line without one.
    expect(paid(buildPayments([attire(0.35)], budget, EVENT), 'makeup-artist')).toBe(87_600);
    expect(paid(buildPayments([attire()], budget, EVENT), 'makeup-artist')).toBe(250_150);
    const both = buildPayments(
      [
        { ...attire(0.35), id: 'makeup' },
        { ...attire(0.15), id: 'mehndi' },
      ],
      budget,
      EVENT,
    );
    expect([paid(both, 'makeup'), paid(both, 'mehndi')]).toEqual([87_600, 37_500]);
    const mixed = buildPayments(
      [
        { ...attire(0.35), id: 'makeup' },
        { ...attire(), id: 'a' },
        { ...attire(), id: 'b' },
      ],
      budget,
      EVENT,
    );
    expect(['makeup', 'a', 'b'].map((id) => paid(mixed, id))).toEqual([87_600, 81_350, 81_200]);
  });

  it('skips vendors without a funded line and zero-sized parts', () => {
    const tiny: BudgetLine[] = [
      { category: 'venue', amount: 0, share: 0, reasons: [] },
      { category: 'attire', amount: 100, share: 0, reasons: [] },
    ];
    const payments = buildPayments(vendors, tiny, EVENT);
    expect(payments).toEqual([
      { vendorId: 'mehndi-artist', kind: 'balance', due: EVENT - 7, amount: 100 },
    ]);
    const full: VendorItem = { ...find(vendors, 'venue'), booked: false, depositShare: 1 };
    expect(buildPayments([full], budget, EVENT)).toEqual([
      { vendorId: 'venue', kind: 'deposit', due: TODAY, amount: 450_000 },
    ]);
  });
});
