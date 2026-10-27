import { describe, expect, it } from 'vitest';
import { fromIso } from '../days.ts';
import { guardReply } from '../guards.ts';
import { TODAY } from '../test-fixtures.ts';
import type { EventInput, Plan, PlanPatch } from '../types.ts';
import { assistOffline, parseChanges } from './assistant.ts';
import { samplePlan, task } from './plan.fixture.ts';

const PLAN = samplePlan();

function changes(message: string, input: Partial<EventInput> = {}): PlanPatch {
  return parseChanges(message, samplePlan({}, input));
}

/** Every reply must pass the same guard that Gemini replies face. */
function ask(message: string, plan: Plan = PLAN): ReturnType<typeof assistOffline> {
  const result = assistOffline(message, plan);
  expect(guardReply(result.reply, plan, result.patch)).toEqual([]);
  return result;
}

describe('parseChanges: guests', () => {
  it.each<[string, number]>([
    ['cut to 180 guests', 180],
    ['Invite 1,200 people', 1200],
    ['add 20 guests', 320],
    ['20 more guests please', 320],
    ['reduce guests by 50', 250],
    ['cut the guest list by 40', 260],
    ['reduce to 150 guests', 150],
    ['cut guests by 10%', 270],
    ['add guests by 5 percent', 315],
    ['remove 50 guests', 250],
    ['take off 50 guests', 250],
    ['we want fewer than 200 guests', 200],
    ['increase guests to 400', 400],
    ['guests 250', 250],
    ['headcount: 260', 260],
    ['add 10% more guests', 330],
    ['reduce guests from 300 to 250', 250],
    ['200 मेहमान', 200],
  ])('%s → %i', (message, invited) => {
    expect(changes(message).invited).toBe(invited);
  });
});

describe('parseChanges: budget', () => {
  it.each<[string, number]>([
    ['budget 8 lakh', 800_000],
    ['set the budget to ₹8,00,000', 800_000],
    ['Budget 1.5 crore', 15_000_000],
    ['budget 75k', 75_000],
    ['budget 90 thousand', 90_000],
    ['reduce budget by 10%', 2_250_000],
    ['increase the budget by 5 percent', 2_625_000],
    ['cut the budget by 2 lakh', 2_300_000],
    ['add ₹50,000 to the budget', 2_550_000],
    ['budget 950000', 950_000],
    ['reduce budget from 25 lakh to 20 lakh', 2_000_000],
    ['budget 5 lakh 50 thousand', 550_000],
    ['बजट 5 लाख 50 हजार', 550_000],
    ['बजट 8 लाख', 800_000],
    ['बजट ८ लाख', 800_000],
    ['बजट 1 करोड़', 10_000_000],
    ['बजट 90 हज़ार', 90_000],
    ['बजट 90 हजार', 90_000],
  ])('%s → %i', (message, budget) => {
    expect(changes(message).budget).toBe(budget);
  });

  it('keeps both figures when a comma separates the budget from a noun-first headcount', () => {
    expect(changes('budget 10 lakh, guests 200')).toEqual({ budget: 1_000_000, invited: 200 });
  });

  it('reads a precomposed nukta like the decomposed one', () => {
    expect(changes('बजट 2 करोड़')).toEqual({ budget: 20_000_000 });
  });

  it('reads the money, not the headcount, when both share a clause', () => {
    expect(changes('budget for 200 guests: 8 lakh')).toEqual({ invited: 200, budget: 800_000 });
  });

  it('ignores a percentage without a direction and a budget without a figure', () => {
    expect(changes('guests by 10%')).toEqual({});
    expect(changes('budget 10%')).toEqual({});
    expect(changes('is the budget ok?')).toEqual({});
  });
});

describe('parseChanges: dates and times', () => {
  it('reads ISO dates and named days counted from the plan today (a Tuesday)', () => {
    expect(changes('move to 2026-12-12')).toEqual({ date: '2026-12-12' });
    expect(changes('move it to next Saturday')).toEqual({ date: '2026-10-31' });
    expect(changes('this tuesday')).toEqual({ date: '2026-11-03' });
    expect(changes('coming Monday')).toEqual({ date: '2026-11-02' });
  });

  it('moves to the nearest weekday, never into the past', () => {
    const on = (iso: string): Plan =>
      samplePlan({ daysToGo: (fromIso(iso) ?? 0) - TODAY }, { date: iso });
    expect(changes('move it to a weekday')).toEqual({ date: '2027-02-18' });
    expect(parseChanges('make it a weekday', on('2027-02-19'))).toEqual({ date: '2027-02-18' });
    expect(parseChanges('make it a weekday', on('2027-02-21'))).toEqual({ date: '2027-02-22' });
    const soon = samplePlan({ today: TODAY + 3, daysToGo: 1 }, { date: '2026-10-31' });
    expect(parseChanges('switch to a weekday', soon)).toEqual({ date: '2026-11-02' });
    const midweek = samplePlan({ daysToGo: 1 }, { date: '2026-10-28' });
    expect(parseChanges('move to a weekday', midweek)).toEqual({ date: '2026-10-28' });
    expect(changes('is a weekday cheaper?')).toEqual({});
  });

  it('reads start times', () => {
    expect(changes('start at 7pm')).toEqual({ startTime: '19:00' });
    expect(changes('begin at 19:30')).toEqual({ startTime: '19:30' });
    expect(changes('starts at 12 am')).toEqual({ startTime: '00:00' });
    expect(changes('start at 12:15 pm')).toEqual({ startTime: '12:15' });
    expect(changes('start at 9')).toEqual({ startTime: '09:00' });
    expect(changes('change the start time to 18:30')).toEqual({ startTime: '18:30' });
    expect(changes('starting budget 8 lakh')).toEqual({ budget: 800_000 });
    expect(changes('start at 7.30pm')).toEqual({ startTime: '19:30' });
  });

  it('never reads a date or a clock time as the budget', () => {
    expect(changes('move to 2026-12-12 with a budget of 18 lakh')).toEqual({
      date: '2026-12-12',
      budget: 1_800_000,
    });
    expect(changes('start at 19:00 with budget 18 lakh')).toEqual({
      startTime: '19:00',
      budget: 1_800_000,
    });
    expect(changes('start at 7.30pm, budget 18 lakh')).toEqual({
      startTime: '19:30',
      budget: 1_800_000,
    });
  });
});

describe('parseChanges: needs, setting and functions', () => {
  it.each<[string, readonly string[] | undefined]>([
    ['add jain', ['jain']],
    ['make it vegetarian', ['vegetarian']],
    ['remove alcohol', ['alcohol-free']],
    ['no alcohol please', ['alcohol-free']],
    ['make it a dry wedding', ['alcohol-free']],
    ['we need step-free access', ['step-free']],
    ['make it eco-friendly and kid-friendly', ['eco-friendly', 'kid-friendly']],
    ['keep a strict budget', ['budget-strict']],
    ['make the budget strict', ['budget-strict']],
    ['keep the schedule strict', undefined],
    ['do we have halal food?', undefined],
    ['halal food', undefined],
    ['what about halal?', undefined],
  ])('%s → %j', (message, constraints) => {
    expect(changes(message).constraints).toEqual(constraints);
  });

  it('removes needs, including through inverted words', () => {
    const base = { constraints: ['alcohol-free', 'jain', 'vegetarian'] as const };
    expect(changes('remove jain', base).constraints).toEqual(['alcohol-free', 'vegetarian']);
    expect(changes('serve alcohol', base).constraints).toEqual(['jain', 'vegetarian']);
    expect(changes('make it non-veg', base).constraints).toEqual(['alcohol-free', 'jain']);
    expect(changes('remove alcohol-free', base).constraints).toEqual(['jain', 'vegetarian']);
    expect(changes('add jain', base)).toEqual({});
  });

  it('keeps both needs across clauses, and lends a verb to a clause without one', () => {
    expect(changes('add jain and remove alcohol').constraints).toEqual(['jain', 'alcohol-free']);
    expect(changes('remove halal, jain', { constraints: ['halal', 'jain'] }).constraints).toEqual(
      [],
    );
  });

  it('lends a change word to a relative figure only', () => {
    expect(changes('add 20 guests and budget 8 lakh')).toEqual({ invited: 320, budget: 800_000 });
    expect(changes('increase the budget by 1 lakh and guests by 20')).toEqual({
      budget: 2_600_000,
      invited: 320,
    });
    expect(changes('reduce guests by 50 and budget by 10%')).toEqual({
      invited: 250,
      budget: 2_250_000,
    });
    expect(changes('guests by 20')).toEqual({ invited: 20 });
  });

  it.each<[string, string | undefined]>([
    ['make it outdoor', 'outdoor'],
    ['move indoors', 'indoor'],
    ['switch to a lawn', 'outdoor'],
    ['make it indoor and outdoor', 'mixed'],
    ['have it mixed', 'mixed'],
    ['hold it in a banquet hall', 'indoor'],
    ['is outdoor risky?', undefined],
    ['make it lovely', undefined],
    ['make the hall festive', undefined],
  ])('%s → setting %s', (message, setting) => {
    expect(changes(message).setting).toBe(setting);
  });

  it('adds and drops wedding functions only', () => {
    expect(changes('add a sangeet').functions).toEqual([
      'ceremony',
      'mehndi',
      'reception',
      'sangeet',
    ]);
    expect(changes('drop the mehendi').functions).toEqual(['ceremony', 'reception']);
    expect(changes('add the mehndi')).toEqual({});
    expect(changes('make the haldi outdoor')).toEqual({ setting: 'outdoor' });
    expect(changes('add a haldi and sangeet').functions).toEqual([
      'ceremony',
      'haldi',
      'mehndi',
      'reception',
      'sangeet',
    ]);
    expect(changes('what happens at the haldi?')).toEqual({});
    expect(changes('add a sangeet', { type: 'birthday', functions: [] })).toEqual({});
  });
});

describe('assistOffline: changes', () => {
  it('proposes a validated patch with a before/after reply', () => {
    const result = ask('cut to 180 guests and budget 20 lakh');
    expect(result.patch).toEqual({ invited: 180, budget: 2_000_000 });
    expect(result.reply).toBe(
      'Proposed change: guests 300 → 180; budget ₹25,00,000 → ₹20,00,000. ' +
        'Preview it and apply it if it looks right.',
    );
  });

  it('describes every kind of field', () => {
    const result = ask(
      'move to 2026-12-12, start at 7pm, make it outdoor, add jain, add a sangeet',
    );
    expect(result.reply).toBe(
      'Proposed change: date Saturday, 20 February 2027 → Saturday, 12 December 2026; ' +
        'start 18:00 → 19:00; setting indoor → outdoor; needs +jain; functions +sangeet. ' +
        'Preview it and apply it if it looks right.',
    );
    expect(
      ask('drop the reception and remove jain', samplePlan({}, { constraints: ['jain'] })).reply,
    ).toContain('needs −jain; functions −reception');
  });

  it('rejects a change the form would reject, with no patch', () => {
    expect(ask('cut to 9000 guests')).toEqual({
      reply: 'I could not make that change. Guests invited must be between 1 and 5,000.',
    });
    expect(ask('remove the ceremony').reply).toBe(
      'I could not make that change. A wedding always includes the ceremony.',
    );
    expect(ask('start at 25').patch).toBeUndefined();
  });

  it('says so when the plan already matches', () => {
    expect(ask('cut to 300 guests')).toEqual({ reply: 'Your plan already has that.' });
  });
});

describe('assistOffline: questions', () => {
  it('lists late tasks, or the next task when nothing is late', () => {
    expect(ask('What is late?').reply).toBe(
      '1 task is late: Book the venue. ' +
        'The timeline spreads them from today, one working day apart, so start with the first.',
    );
    const many = samplePlan({
      tasks: ['a', 'b', 'c', 'd', 'e'].map((id) =>
        task({ id, title: id.toUpperCase(), status: 'late' }),
      ),
    });
    expect(ask('anything overdue?', many).reply).toMatch(
      /^5 tasks are late: A; B; C, and 2 more\./,
    );
    const calm = samplePlan({ tasks: [task({ id: 'x', title: 'Book the DJ', due: TODAY + 3 })] });
    expect(ask('are we behind?', calm).reply).toBe(
      'Nothing is late. Next up: Book the DJ (due 30 Oct).',
    );
    expect(ask('missed anything?', samplePlan({ tasks: [] })).reply).toBe('Nothing is late.');
    const risky = samplePlan({
      tasks: [task({ id: 'y', title: 'Order the cake', due: TODAY + 1, status: 'at-risk' })],
    });
    expect(ask('late?', risky).reply).toBe(
      'Nothing is late. Next up: Order the cake (due 28 Oct).',
    );
  });

  it('explains how to save, from the plan trims', () => {
    expect(ask('How can I save money?').reply).toBe(
      'Ways to save, largest first: Invite fewer guests (saves about ₹3,00,000); ' +
        'Pick a weekday date (saves about ₹50,000). Ask me to apply one and I will show the change.',
    );
    const comfy = samplePlan({
      feasibility: { verdict: 'comfortable', perGuest: 20_000, floor: 3400, trims: [] },
    });
    expect(ask('any way to cut costs?', comfy).reply).toBe(
      'Your budget looks comfortable, so no savings are needed. ₹2,50,000 is held back as contingency.',
    );
  });

  it('says what to book first', () => {
    expect(ask('What should I book first?').reply).toBe(
      'Start with: 1. Book the venue (due 27 Oct) 2. Book the caterer (due 6 Nov)',
    );
    expect(ask('what next?', samplePlan({ topActions: [] })).reply).toBe(
      'Everything is on track; nothing needs doing yet.',
    );
  });

  it('lists upcoming payments in date order with vendor labels', () => {
    expect(ask('when are payments due?').reply).toBe(
      'Next payments: Caterer deposit ₹2,25,000 by 6 Nov; Caterer balance ₹6,75,000 by 13 Feb.',
    );
    const unknown = samplePlan({ vendors: [] });
    expect(ask('deposit?', unknown).reply).toMatch(/^Next payments: caterer deposit/);
    expect(ask('pay?', samplePlan({ payments: [] })).reply).toBe('No payments are scheduled.');
  });

  it('answers budget questions from the feasibility figures', () => {
    const expected =
      'Your budget is tight: ₹9,804 per expected guest for 255 guests, against a modest floor of ₹3,400 per guest.';
    expect(ask('Is my budget enough?').reply).toBe(expected);
    expect(ask('tell me about the budget').reply).toBe(expected);
    expect(ask('is it realistic?', samplePlan({ expected: 1 })).reply).toContain('for 1 guest,');
  });

  it.each(['is 20 lakh enough?', 'can we afford 400 guests?'])(
    'answers "%s" instead of proposing a change',
    (message) => {
      const result = ask(message);
      expect(result.patch).toBeUndefined();
      expect(result.reply).toMatch(/^Your budget is tight/);
    },
  );

  it('still proposes a change asked as a question with a change word', () => {
    expect(ask('what if we cut to 200 guests?').patch).toEqual({ invited: 200 });
  });

  it('offers help for anything else', () => {
    expect(ask('hello').reply).toBe(
      'Your plan: 116 days to go, 255 guests expected, budget tight. Ask what is late, how to ' +
        'save money, what to book first or when payments are due, or ask for a change such as ' +
        '"cut to 180 guests", "reduce the budget by 10%", "move to next Saturday", "add jain" ' +
        'or "make it outdoor".',
    );
    expect(ask('x'.repeat(600) + ' late').reply).toMatch(/^Your plan:/);
  });
});
