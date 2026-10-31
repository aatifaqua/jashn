import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assistOffline } from './fallback/assistant.ts';
import { draftEnquiry } from './fallback/draft.ts';
import { ideasOffline } from './fallback/ideas.ts';
import { guardDraft, guardIdeas, guardReply } from './guards.ts';
import { PATCH_FIELDS } from './ids.ts';
import { applyPatch, validateInput, validatePatch } from './input.ts';
import { buildPlan, diffPlans } from './plan.ts';
import { getProfile } from './profiles/all.ts';
import { RULES } from './rules.ts';
import { caseArb, inputArb } from './test-fixtures.ts';
import type { EventInput, Plan, PlanPatch } from './types.ts';

function planOf(input: EventInput, today: number): Plan {
  return buildPlan(input, today, getProfile(input.type));
}

function eventDayOf(plan: Plan): number {
  return plan.today + plan.daysToGo;
}

describe('buildPlan invariants (any valid input)', () => {
  it('inputs from the generator are valid', () => {
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        expect(validateInput(input, today).ok).toBe(true);
      }),
    );
  });

  it('budget lines plus contingency equal the budget exactly, in ₹100 lines', () => {
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        const plan = planOf(input, today);
        const lines = plan.budget.reduce((sum, line) => sum + line.amount, 0);
        expect(lines + plan.contingency).toBe(input.budget);
        expect(plan.contingency).toBeGreaterThanOrEqual(0);
        for (const line of plan.budget) {
          expect(line.amount % 100).toBe(0);
          const parts = line.perFunction?.reduce((sum, part) => sum + part.amount, 0);
          expect(parts ?? line.amount).toBe(line.amount);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('no task is due before today or after the event, except in the After phase', () => {
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        const plan = planOf(input, today);
        const eventDay = eventDayOf(plan);
        for (const task of plan.tasks) {
          expect(task.due).toBeGreaterThanOrEqual(today);
          if (task.phase === 'after') expect(task.due).toBeGreaterThan(eventDay);
          else expect(task.due).toBeLessThanOrEqual(eventDay);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never schedules a task before the open task it depends on', () => {
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        const plan = planOf(input, today);
        const byId = new Map(plan.tasks.map((task) => [task.id, task]));
        for (const template of getProfile(input.type).tasks) {
          const task = byId.get(template.id);
          const first = template.after === undefined ? undefined : byId.get(template.after);
          if (task === undefined || first === undefined || first.status === 'done') continue;
          expect(first.due).toBeLessThanOrEqual(task.due);
          if (task.due < eventDayOf(plan)) expect(first.due).toBeLessThan(task.due);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('carries every declared diet to the caterer questions', () => {
    // A clean-up drive serves volunteers' refreshments without hiring a caterer.
    const diets = ['vegetarian', 'jain', 'halal'] as const;
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        const caterer = planOf(input, today).vendors.find((vendor) => vendor.id === 'caterer');
        expect(caterer === undefined).toBe(input.style === 'clean-up');
        if (caterer === undefined) return;
        for (const diet of diets.filter((id) => input.constraints.includes(id))) {
          const asked = RULES.find((rule) => rule.id === diet)?.effects.questions ?? [];
          for (const { vendorId, text } of asked) {
            if (vendorId === 'caterer') expect(caterer.questions).toContain(text);
          }
        }
      }),
    );
  });

  it('keeps top actions open and at most three, and lists every payment within the plan', () => {
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        const plan = planOf(input, today);
        expect(plan.topActions.length).toBeLessThanOrEqual(3);
        expect(plan.topActions.every((task) => task.status !== 'done')).toBe(true);
        for (const payment of plan.payments) {
          expect(payment.amount).toBeGreaterThan(0);
          expect(payment.due).toBeLessThanOrEqual(eventDayOf(plan));
        }
      }),
    );
  });

  it('reports no change between a plan and itself', () => {
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        const plan = planOf(input, today);
        const diff = diffPlans(plan, plan);
        expect(diff.budget).toEqual([]);
        expect(diff.newlyLate).toEqual([]);
      }),
      { numRuns: 50 },
    );
  });
});

/** A valid patch: a random subset of patchable fields taken from another valid input. */
const patchCase = caseArb.chain(({ input, today }) =>
  fc
    .tuple(inputArb(input.type, today), fc.subarray([...PATCH_FIELDS], { minLength: 1 }))
    .map(([other, keys]) => {
      const patch = Object.fromEntries(keys.map((key) => [key, other[key]])) as PlanPatch;
      return { input, today, patch };
    }),
);

describe('patches', () => {
  it('applyPatch then validateInput succeeds for every valid patch', () => {
    fc.assert(
      fc.property(patchCase, ({ input, today, patch }) => {
        const applied = applyPatch(input, patch);
        expect(validateInput(applied, today)).toEqual({ ok: true, value: applied });
        const checked = validatePatch(patch, input, today);
        expect(checked.ok && checked.value).toEqual(applied);
      }),
      { numRuns: 300 },
    );
  });
});

describe('fallbacks pass the guards that Gemini output faces', () => {
  it('offline ideas never conflict with the declared diet or carry links or prices', () => {
    fc.assert(
      fc.property(caseArb, ({ input, today }) => {
        const clean = validateInput(input, today);
        if (!clean.ok) throw new Error('generator produced an invalid input');
        expect(guardIdeas(ideasOffline(clean.value), clean.value.constraints)).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });

  it('offline drafts and replies quote only figures the plan states', () => {
    const questions = ['what is late?', 'how can I save?', 'when are payments due?', 'hi'];
    fc.assert(
      fc.property(caseArb, fc.constantFrom(...questions), ({ input, today }, question) => {
        const plan = planOf(input, today);
        for (const vendor of plan.vendors) {
          expect(guardDraft(draftEnquiry(plan, vendor).text, plan)).toEqual([]);
        }
        const answer = assistOffline(question, plan);
        expect(guardReply(answer.reply, plan, answer.patch)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
