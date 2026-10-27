import { describe, expect, it } from 'vitest';
import { deriveContext } from './context.ts';
import { getProfile } from './profiles/index.ts';
import { RULES, fireRules } from './rules.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import type { Constraint, EventInput } from './types.ts';

function fire(overrides: Partial<EventInput> = {}) {
  const input = sampleInput(overrides);
  return fireRules(deriveContext(input, TODAY, getProfile(input.type)), input);
}

function ids(overrides: Partial<EventInput> = {}): string[] {
  return fire(overrides).map((rule) => rule.id);
}

function find(id: string, overrides: Partial<EventInput> = {}) {
  const rule = fire(overrides).find((fired) => fired.id === id);
  if (rule === undefined) throw new Error(`rule ${id} did not fire`);
  return rule;
}

const birthday = { type: 'birthday', style: 'kids', functions: [] } as const;
const community = { type: 'community', style: 'festival', functions: [] } as const;

describe('RULES', () => {
  it('has unique ids and is deeply frozen', () => {
    const all = RULES.map((rule) => rule.id);
    expect(new Set(all).size).toBe(all.length);
    expect(Object.isFrozen(RULES)).toBe(true);
    for (const rule of RULES) expect(Object.isFrozen(rule.effects)).toBe(true);
  });
});

describe('fireRules', () => {
  it('fires peak season, large crowd for the sample wedding', () => {
    expect(ids()).toEqual(['peak-season', 'large-crowd']);
  });

  it('names the date in the peak-season reason and stretches key lead times', () => {
    const rule = find('peak-season');
    expect(rule.reason.text).toContain('20 Feb 2027');
    expect(rule.effects.leadFactor).toEqual({
      vendorIds: ['venue', 'caterer', 'photographer'],
      factor: 1.25,
    });
    expect(ids({ ...birthday, date: '2027-01-20' })).not.toContain('peak-season');
  });

  it('covers rain for outdoor events in the monsoon', () => {
    const rule = find('monsoon-outdoor', { date: '2027-07-10', setting: 'mixed' });
    expect(rule.reason.text).toContain('mixed');
    expect(rule.reason.text).toContain('10 Jul 2027');
    expect(rule.effects.tasks?.[0]?.id).toBe('rain-cover');
    expect(rule.effects.slots).toHaveLength(1);
    expect(ids({ date: '2027-07-10', setting: 'indoor' })).not.toContain('monsoon-outdoor');
  });

  it('adds shade and water to daytime outdoor summer events', () => {
    const input: Partial<EventInput> = {
      ...birthday,
      date: '2027-05-08',
      setting: 'outdoor',
      startTime: '16:00',
    };
    expect(find('summer-outdoor', input).reason.text).toContain('16:00');
    expect(ids({ ...input, startTime: '17:00' })).not.toContain('summer-outdoor');
    expect(ids({ ...input, setting: 'mixed' })).not.toContain('summer-outdoor');
  });

  it('notes weekday savings and names the weekday', () => {
    const rule = find('weekday', { date: '2027-02-17' });
    expect(rule.reason.text).toBe('17 Feb 2027 is a Wednesday; venues are often cheaper midweek.');
    expect(rule.effects.notices).toHaveLength(1);
  });

  it('pins "Lock the venue today" on short notice', () => {
    const rule = find('short-notice', { date: '2027-01-05' });
    expect(rule.reason.text).toBe(
      'Only 70 days to go for this wedding, so bookings are compressed.',
    );
    expect(rule.effects.pinTasks).toEqual(['lock-venue']);
    expect(rule.effects.tasks?.[0]?.title).toBe('Lock the venue today');
  });

  it('completes the venue tasks when the venue is booked', () => {
    const rule = find('venue-booked', { venueBooked: true });
    expect(rule.reason.text).toContain('already booked');
    expect(rule.effects.completeTasks).toEqual(['book-venue', 'lock-venue']);
  });

  it('adds an ambulance from 1,000 expected', () => {
    expect(ids({ ...community, style: 'clean-up', invited: 999 })).not.toContain('ambulance');
    const rule = find('ambulance', { ...community, style: 'clean-up', invited: 1000 });
    expect(rule.reason.text).toContain('1,000');
  });

  it('lists permissions for public gatherings, marked to check local rules', () => {
    const rule = find('public-gathering', { ...community, setting: 'outdoor', invited: 120 });
    expect(rule.reason.text).toContain('outdoor community event for about 180 people');
    const titles = rule.effects.tasks?.map((task) => task.title) ?? [];
    expect(titles).toHaveLength(4);
    for (const title of titles) expect(title).toContain('(check local rules)');
    expect(ids({ ...community, invited: 100 })).not.toContain('public-gathering');
  });

  it('applies every declared need in table order', () => {
    const constraints: Constraint[] = [
      'alcohol-free',
      'budget-strict',
      'eco-friendly',
      'halal',
      'jain',
      'kid-friendly',
      'step-free',
      'vegetarian',
    ];
    expect(ids({ invited: 50, date: '2027-03-20', constraints })).toEqual([
      'step-free',
      'jain',
      'vegetarian',
      'halal',
      'alcohol-free',
      'kid-friendly',
      'eco-friendly',
      'budget-strict',
    ]);
  });

  it('gives each need a reason and effects that name it', () => {
    const cases: [Constraint, string][] = [
      ['step-free', 'step-free'],
      ['jain', 'Jain'],
      ['vegetarian', 'vegetarian'],
      ['halal', 'halal'],
      ['alcohol-free', 'alcohol-free'],
      ['kid-friendly', 'kid-friendly'],
      ['eco-friendly', 'eco-friendly'],
      ['budget-strict', 'strict'],
    ];
    for (const [need, word] of cases) {
      const rule = find(need, { constraints: [need] });
      expect(rule.reason.code).toBe(need);
      expect(rule.reason.text).toContain(word);
    }
  });

  it('routes every dietary need to the caterer', () => {
    for (const need of ['jain', 'vegetarian', 'halal'] as const) {
      const vendors = find(need, { constraints: [need] }).effects.questions?.map(
        (question) => question.vendorId,
      );
      expect(vendors).toContain('caterer');
    }
  });

  it('removes the bar and bartender when alcohol-free', () => {
    const { effects } = find('alcohol-free', { constraints: ['alcohol-free'] });
    expect(effects.budget).toEqual([{ kind: 'remove', category: 'bar' }]);
    expect(effects.removeVendors).toEqual(['bartender']);
  });

  it('holds 15 % and always shows trims when budget-strict', () => {
    const { effects } = find('budget-strict', { constraints: ['budget-strict'] });
    expect(effects.contingency).toBe(0.15);
    expect(effects.alwaysTrim).toBe(true);
  });
});
