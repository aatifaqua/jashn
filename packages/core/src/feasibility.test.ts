import { describe, expect, it } from 'vitest';
import { assessFeasibility, costFloor, verdictFor } from './feasibility.ts';
import { deriveContext } from './context.ts';
import { getProfile } from './profiles/all.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import type { BudgetLine, EventInput } from './types.ts';

const LINES: readonly BudgetLine[] = [
  { category: 'venue', amount: 400_000, share: 0.16, reasons: [] },
  { category: 'catering', amount: 800_000, share: 0.32, reasons: [] },
];

function assess(overrides: Partial<EventInput>, alwaysTrim = false) {
  const input = sampleInput(overrides);
  const profile = getProfile(input.type);
  const ctx = deriveContext(input, TODAY, profile);
  return assessFeasibility(input, profile, ctx, { lines: LINES, alwaysTrim });
}

describe('costFloor', () => {
  it('uses the tier floor of each type', () => {
    const one = { functions: ['ceremony'] };
    expect(costFloor(sampleInput({ ...one, tier: 'metro' }), getProfile('wedding'))).toBe(3000);
    expect(costFloor(sampleInput({ ...one, tier: 'town' }), getProfile('wedding'))).toBe(1200);
    const party = sampleInput({ type: 'birthday', functions: [], tier: 'tier2' });
    expect(costFloor(party, getProfile('birthday'))).toBe(500);
    const mela = sampleInput({ type: 'community', functions: [], tier: 'metro' });
    expect(costFloor(mela, getProfile('community'))).toBe(150);
  });

  it('raises the wedding floor 35 % per extra function', () => {
    const wedding = getProfile('wedding');
    expect(costFloor(sampleInput({ functions: ['ceremony', 'haldi'] }), wedding)).toBe(2700);
    expect(costFloor(sampleInput(), wedding)).toBe(3400);
    const all = ['haldi', 'mehndi', 'sangeet', 'ceremony', 'reception'];
    expect(costFloor(sampleInput({ functions: all, tier: 'metro' }), wedding)).toBe(7200);
  });
});

describe('verdictFor', () => {
  it('is comfortable at 1.5 × the floor, tight at the floor, else unrealistic', () => {
    expect(verdictFor(150_000, 100, 1000)).toBe('comfortable');
    expect(verdictFor(149_999, 100, 1000)).toBe('tight');
    expect(verdictFor(100_000, 100, 1000)).toBe('tight');
    expect(verdictFor(99_999, 100, 1000)).toBe('unrealistic');
  });
});

describe('assessFeasibility', () => {
  it('reports the per-guest figure and hides trims when comfortable', () => {
    const result = assess({});
    expect(result).toEqual({ verdict: 'comfortable', perGuest: 9804, floor: 3400, trims: [] });
  });

  it('shows trims when tight or unrealistic', () => {
    expect(assess({ invited: 900, budget: 3_000_000 }).verdict).toBe('tight');
    expect(assess({ invited: 900, budget: 3_000_000 }).trims.length).toBeGreaterThan(0);
    expect(assess({ budget: 500_000 }).verdict).toBe('unrealistic');
    expect(assess({ budget: 500_000 }).trims.length).toBeGreaterThan(0);
  });

  it('shows trims when comfortable under budget-strict', () => {
    expect(assess({}, true).trims.length).toBeGreaterThan(0);
  });
});
