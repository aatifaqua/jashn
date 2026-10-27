import { fromCivil } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import {
  compactRupees,
  count,
  dayLabel,
  daysToGoText,
  isoDay,
  lateByText,
  longDay,
  percent,
  rupees,
  shortDay,
} from './format.ts';

const DAY = fromCivil(2027, 2, 20);

describe('format', () => {
  it('formats rupees and counts with Indian grouping', () => {
    expect(rupees(1_600_000)).toBe('₹16,00,000');
    expect(count(250_000)).toBe('2,50,000');
    expect(compactRupees(1_600_000)).toMatch(/^₹16(\.0)?\s?L/);
    expect(percent(0.3)).toBe('30%');
  });

  it('formats day numbers without time-zone drift', () => {
    expect(dayLabel(DAY)).toBe('20 Feb 2027');
    expect(shortDay(DAY)).toBe('Sat, 20 Feb');
    expect(longDay(DAY)).toBe('Saturday, 20 February 2027');
    expect(isoDay(DAY)).toBe('2027-02-20');
  });

  it('words the countdown', () => {
    expect(daysToGoText(0)).toBe('Today');
    expect(daysToGoText(1)).toBe('1 day to go');
    expect(daysToGoText(1200)).toBe('1,200 days to go');
  });

  it('words lateness only for late tasks', () => {
    expect(lateByText(DAY, DAY)).toBe('');
    expect(lateByText(DAY - 1, DAY)).toBe('1 day late');
    expect(lateByText(DAY - 12, DAY)).toBe('12 days late');
  });
});
