import { describe, expect, it } from 'vitest';
import { fromIso } from './days.ts';
import { applyPatch } from './input.ts';
import { buildPlan, diffPlans } from './plan.ts';
import { getProfile } from './profiles/all.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import type { EventInput, Plan } from './types.ts';

const WEDDING = getProfile('wedding');

function plan(overrides: Partial<EventInput> = {}, today = TODAY): Plan {
  return buildPlan(sampleInput(overrides), today, WEDDING);
}

describe('buildPlan', () => {
  it('funds no bar and books no bartender for a halal wedding', () => {
    const plan = buildPlan(
      sampleInput({ style: 'intimate', constraints: ['halal'] }),
      TODAY,
      WEDDING,
    );
    expect(plan.budget.map((line) => line.category)).not.toContain('bar');
    expect(plan.vendors.map((vendor) => vendor.id)).not.toContain('bartender');
    expect(plan.tasks.some((task) => task.vendorId === 'bartender')).toBe(false);
  });

  it('flags invitations as at-risk for a wedding six days out instead of hiding them', () => {
    const all = ['haldi', 'mehndi', 'sangeet', 'ceremony', 'reception'] as const;
    const plan = buildPlan(
      sampleInput({ date: '2026-11-02', functions: [...all] }),
      TODAY,
      WEDDING,
    );
    for (const id of ['order-invites', 'send-invites']) {
      const task = plan.tasks.find((t) => t.id === id);
      expect(task?.status).toBe('at-risk');
      expect(task?.reasons.at(-1)?.text).toContain('the last day this can realistically happen');
    }
  });

  it('assembles every stage for the input', () => {
    const built = plan();
    expect(built.input).toEqual(sampleInput({ functions: ['ceremony', 'mehndi', 'reception'] }));
    expect(built.daysToGo).toBe((fromIso('2027-02-20') ?? 0) - TODAY);
    expect(built.expected).toBe(255);
    expect(built.volunteers).toBe(0);
    expect(built.budget.reduce((sum, line) => sum + line.amount, built.contingency)).toBe(
      2_500_000,
    );
    expect(built.tasks.length).toBeGreaterThan(20);
    expect(built.vendors.map((vendor) => vendor.id)).toContain('mehndi-artist');
    expect(built.payments.length).toBeGreaterThan(0);
    expect(built.runSheet.length).toBeGreaterThan(0);
    expect(built.topActions.length).toBe(3);
    expect(built.notices.map((notice) => notice.code)).toEqual(['peak-prices']);
  });

  it('collects notices from every fired rule in rule order', () => {
    const built = plan({ constraints: ['alcohol-free', 'eco-friendly'], date: '2027-02-17' });
    expect(built.notices.map((notice) => notice.code)).toEqual([
      'peak-prices',
      'weekday-rate',
      'mocktails',
      'e-invites',
    ]);
  });

  it('rejects a profile of another event type', () => {
    expect(() => buildPlan(sampleInput(), TODAY, getProfile('birthday'))).toThrow(
      'A wedding needs the wedding profile, not birthday.',
    );
  });

  it('returns one frozen plan for inputs that normalise alike', () => {
    const first = plan({ city: '  Lucknow ', constraints: ['vegetarian', 'halal'] });
    const second = plan({ city: 'Lucknow', constraints: ['halal', 'vegetarian'] });
    expect(second).toBe(first);
    expect(first.input.city).toBe('Lucknow');
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.tasks[0])).toBe(true);
    expect(plan({}, TODAY + 1)).not.toBe(plan());
  });

  it('builds afresh for a different profile object of the same type', () => {
    const copy = { ...WEDDING };
    const own = buildPlan(sampleInput({ invited: 299 }), TODAY, copy);
    expect(buildPlan(sampleInput({ invited: 299 }), TODAY, WEDDING)).not.toBe(own);
    expect(buildPlan(sampleInput({ invited: 299 }), TODAY, WEDDING)).toEqual(own);
  });

  it('keeps the sixteen most recently used plans', () => {
    const kept = plan({ invited: 1000 });
    const evicted = plan({ invited: 1001 });
    for (let invited = 1002; invited < 1016; invited += 1) plan({ invited });
    expect(plan({ invited: 1000 })).toBe(kept);
    plan({ invited: 1016 });
    expect(plan({ invited: 1000 })).toBe(kept);
    expect(plan({ invited: 1001 })).not.toBe(evicted);
  });
});

describe('diffPlans', () => {
  it('lists headcount, verdict, changed lines and newly late tasks', () => {
    const before = plan();
    const after = buildPlan(
      applyPatch(before.input, { invited: 600, date: '2026-12-26', constraints: ['alcohol-free'] }),
      TODAY,
      WEDDING,
    );
    const diff = diffPlans(before, after);
    expect(diff.expected).toEqual({ before: 255, after: 510 });
    expect(diff.verdict).toEqual({ before: 'comfortable', after: 'tight' });
    expect(diff.budget.find((line) => line.category === 'bar')).toEqual({
      category: 'bar',
      before: 44_300,
      after: 0,
    });
    const lateBefore = new Set(
      before.tasks.filter((task) => task.status === 'late').map((t) => t.id),
    );
    expect(diff.newlyLate.length).toBeGreaterThan(0);
    expect(diff.newlyLate.every((task) => !lateBefore.has(task.id))).toBe(true);
  });

  it('counts a line that appears only after the change from zero', () => {
    const dry = plan({ constraints: ['alcohol-free'] });
    const diff = diffPlans(dry, plan());
    expect(diff.budget.find((line) => line.category === 'bar')).toEqual({
      category: 'bar',
      before: 0,
      after: 44_300,
    });
    expect(diff.budget.map((line) => line.category).at(-1)).toBe('bar');
  });
});
