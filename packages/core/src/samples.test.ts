import { describe, expect, it } from 'vitest';
import { fromIso, toIso, weekday } from './days.ts';
import { validateInput } from './input.ts';
import { buildPlan } from './plan.ts';
import { getProfile } from './profiles/all.ts';
import { SAMPLE_IDS, sampleEvent, sampleLabel, type SampleId } from './samples.ts';
import { TODAY } from './test-fixtures.ts';
import type { Plan } from './types.ts';

function samplePlan(id: SampleId): Plan {
  const result = validateInput(sampleEvent(id, TODAY), TODAY);
  if (!result.ok) throw new Error(`sample ${id} is invalid`);
  return buildPlan(result.value, TODAY, getProfile(result.value.type));
}

function amounts(plan: Plan): Record<string, number> {
  return Object.fromEntries(plan.budget.map((line) => [line.category, line.amount]));
}

describe('samples', () => {
  it('labels every sample and dates it on a Saturday after its lead time, valid from any day', () => {
    expect(SAMPLE_IDS.map(sampleLabel)).toEqual(['Lucknow wedding', '7th birthday', 'Diwali mela']);
    for (const id of SAMPLE_IDS) {
      for (let today = TODAY; today < TODAY + 7; today += 1) {
        const input = sampleEvent(id, today);
        expect(validateInput(input, today).ok).toBe(true);
        const day = fromIso(input.date) ?? 0;
        expect(weekday(day)).toBe(6);
        expect(day - today).toBeGreaterThanOrEqual(id === 'lucknow-wedding' ? 120 : 21);
      }
    }
    expect(sampleEvent('lucknow-wedding', TODAY).date).toBe('2027-02-27');
    expect(sampleEvent('kids-birthday', TODAY).date).toBe(toIso(TODAY + 25));
  });
});

describe('scenario: Lucknow wedding with four functions', () => {
  const plan = samplePlan('lucknow-wedding');

  it('pins headcount, verdict and the budget split', () => {
    expect(plan).toMatchObject({
      daysToGo: 123,
      expected: 298,
      volunteers: 0,
      contingency: 160_000,
    });
    expect(plan.feasibility).toMatchObject({ verdict: 'tight', perGuest: 5369, floor: 4100 });
    expect(amounts(plan)).toEqual({
      venue: 250_400,
      catering: 521_700,
      decor: 167_000,
      photography: 139_100,
      attire: 139_100,
      entertainment: 69_600,
      invitations: 27_800,
      gifts: 41_800,
      travel: 55_700,
      bar: 27_800,
    });
    const catering = plan.budget.find((line) => line.category === 'catering');
    expect(catering?.perFunction?.map((part) => part.functionId)).toEqual([
      'mehndi',
      'sangeet',
      'ceremony',
      'reception',
    ]);
  });

  it('ranks trims and puts the late bookings first', () => {
    expect(plan.feasibility.trims.map((trim) => [trim.id, trim.saves])).toEqual([
      ['lunch', 78_300],
      ['invite-fewer', 66_500],
      ['merge-functions', 60_800],
      ['weekday', 25_000],
      ['e-invites', 22_200],
    ]);
    expect(plan.topActions.map((task) => task.id)).toEqual([
      'set-budget',
      'book-venue',
      'book-officiant',
    ]);
    expect(plan.tasks.filter((task) => task.status === 'late')).toHaveLength(5);
    expect(plan.notices.map((notice) => notice.code)).toEqual(['peak-prices']);
  });

  it('asks the venue about step-free access and the caterer about vegetarian food', () => {
    const venue = plan.vendors.find((vendor) => vendor.id === 'venue');
    const caterer = plan.vendors.find((vendor) => vendor.id === 'caterer');
    expect(venue?.questions).toContain('Is there an accessible toilet?');
    expect(caterer?.questions).toContain('Is every dish free of meat, fish and egg?');
    expect(plan.vendors.map((vendor) => vendor.id)).toContain('mehndi-artist');
  });

  it('spreads the run sheet over the function days, mehndi first', () => {
    const days = [...new Set(plan.runSheet.map((slot) => slot.day))];
    const eventDay = TODAY + 123;
    expect(days).toEqual([eventDay - 2, eventDay - 1, eventDay, eventDay + 1]);
  });
});

describe('scenario: 7th birthday with the venue booked', () => {
  const plan = samplePlan('kids-birthday');

  it('is comfortable, needs no trims and treats the venue as done', () => {
    expect(plan).toMatchObject({ daysToGo: 25, expected: 36, contingency: 6000 });
    expect(plan.feasibility).toMatchObject({ verdict: 'comfortable', perGuest: 1667, floor: 800 });
    expect(plan.feasibility.trims).toEqual([]);
    expect(amounts(plan)).toEqual({
      venue: 10_400,
      food: 18_200,
      decor: 6200,
      entertainment: 13_000,
      photography: 2600,
      invitations: 500,
      'return-gifts': 3100,
    });
    expect(plan.tasks.find((task) => task.id === 'book-venue')?.status).toBe('done');
    expect(plan.topActions.map((task) => task.id)).not.toContain('book-venue');
  });

  it("adds a kids' corner and an eggless cake question", () => {
    expect(plan.tasks.map((task) => task.id)).toContain('kids-corner');
    const baker = plan.vendors.find((vendor) => vendor.id === 'baker');
    expect(baker?.questions).toContain('Is the cake eggless?');
  });
});

describe('scenario: short-notice Diwali mela', () => {
  const plan = samplePlan('diwali-mela');

  it('counts walk-ins, volunteers and a tight budget', () => {
    expect(plan).toMatchObject({
      daysToGo: 25,
      expected: 900,
      volunteers: 18,
      contingency: 12_000,
    });
    expect(plan.feasibility).toMatchObject({ verdict: 'tight', perGuest: 133, floor: 100 });
    expect(plan.feasibility.trims.map((trim) => trim.id)).toEqual([
      'lunch',
      'invite-fewer',
      'weekday',
    ]);
  });

  it('compresses the timeline with the venue lock pinned first and permits added', () => {
    expect(plan.topActions[0]?.id).toBe('lock-venue');
    expect(plan.topActions[0]?.due).toBe(TODAY);
    const ids = plan.tasks.map((task) => task.id);
    expect(ids).toEqual(
      expect.arrayContaining(['permit-police', 'permit-fire', 'first-aid', 'waste-segregation']),
    );
    expect(plan.notices.map((notice) => notice.code)).toEqual([
      'compressed',
      'mocktails',
      'e-invites',
    ]);
  });
});
