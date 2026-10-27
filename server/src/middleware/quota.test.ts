import { describe, expect, it } from 'vitest';
import { hourlyBudget } from './quota.ts';

describe('hourlyBudget', () => {
  it('allows the hourly number of calls and refills on the next hour', () => {
    let now = 0;
    const budget = hourlyBudget(2, () => now);
    expect([budget.take(), budget.take(), budget.take()]).toEqual([true, true, false]);
    now = 3_599_999;
    expect(budget.take()).toBe(false);
    now = 3_600_000;
    expect(budget.take()).toBe(true);
  });

  it('allows nothing when the budget is zero', () => {
    expect(hourlyBudget(0, () => 0).take()).toBe(false);
  });
});
