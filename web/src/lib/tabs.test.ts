import { describe, expect, it } from 'vitest';
import { PLAN_TABS, tabIndexForKey } from './tabs.ts';

describe('tabIndexForKey', () => {
  const n = PLAN_TABS.length;

  it('wraps arrows and jumps with Home and End', () => {
    expect(tabIndexForKey('ArrowRight', 0, n)).toBe(1);
    expect(tabIndexForKey('ArrowRight', n - 1, n)).toBe(0);
    expect(tabIndexForKey('ArrowLeft', 0, n)).toBe(n - 1);
    expect(tabIndexForKey('Home', 3, n)).toBe(0);
    expect(tabIndexForKey('End', 0, n)).toBe(n - 1);
    expect(tabIndexForKey('Enter', 2, n)).toBeNull();
  });
});
