import { describe, expect, it } from 'vitest';
import { guardReply } from '../guards.ts';
import { TODAY } from '../test-fixtures.ts';
import type { Plan } from '../types.ts';
import { CHANGE_REPLY, assistOffline } from './assistant.ts';
import { samplePlan, task } from './plan.fixture.ts';

const PLAN = samplePlan();

/** Every reply must pass the same guard that Gemini replies face. */
function ask(message: string, plan: Plan = PLAN): ReturnType<typeof assistOffline> {
  const result = assistOffline(message, plan);
  expect(guardReply(result.reply, plan, result.patch)).toEqual([]);
  return result;
}

describe('assistOffline: changes', () => {
  it.each([
    'cut guests by 20',
    'Move to next Saturday',
    'add jain and make it outdoor',
    'Raise the budget to 25 lakh',
    'change the start time to 7 pm',
  ])('points "%s" to the form, with no patch', (message) => {
    expect(ask(message)).toEqual({ reply: CHANGE_REPLY });
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
        'Pick a weekday date (saves about ₹50,000). Edit details changes the guests, date and ' +
        'start time; the rest you arrange with vendors or sponsors.',
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

  it('answers a question even when it names a change', () => {
    expect(ask('any way to cut costs?').reply).toMatch(/^Ways to save/);
  });

  it.each([
    ['ways to cut costs', /^Ways to save/],
    ['Make it cheaper', /^Ways to save/],
    ['Help me lower the cost', /^Ways to save/],
    ['Tell me what to book first and set priorities', /^Start with:/],
    ['list payments and drop dates', /^Next payments:/],
    ['Who does the make-up?', /^Your plan:/],
    ['which vendor should I call', /^Your plan:/],
  ])('answers "%s" instead of refusing it as a change', (message, reply) => {
    const result = ask(message);
    expect(result.reply).toMatch(reply);
    expect(result.reply).not.toBe(CHANGE_REPLY);
  });

  it('never claims the assistant is offline, since the reply is also served live', () => {
    expect(CHANGE_REPLY).not.toMatch(/live assistant|offline/);
    expect(CHANGE_REPLY).toMatch(/Edit details/);
  });

  it('offers help for anything else', () => {
    expect(ask('hello').reply).toBe(
      'Your plan: 116 days to go, 255 guests expected, budget tight. Ask what is late, how to ' +
        'save money, what to book first or when payments are due. To change the plan, use Edit details.',
    );
    expect(ask('x'.repeat(600) + ' late').reply).toMatch(/^Your plan:/);
  });
});
