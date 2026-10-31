import { fromCivil } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import { daysToGoText, lateByText, percent, shortDay } from './format.ts';

const DAY = fromCivil(2027, 2, 20);

describe('format', () => {
  it('formats a fraction as a whole percentage', () => {
    expect(percent(0.3)).toBe('30%');
  });

  it('formats short days without time-zone drift', () => {
    expect(shortDay(DAY, DAY - 30)).toBe('Sat, 20 Feb');
    // A date in another year than today carries its year.
    expect(shortDay(DAY, fromCivil(2026, 10, 27))).toBe('Sat, 20 Feb, 2027');
  });

  it('words the countdown', () => {
    expect(daysToGoText(0)).toBe('Today');
    expect(daysToGoText(1)).toBe('1 day to go');
    expect(daysToGoText(1200)).toBe('1,200 days to go');
    expect(daysToGoText(-1)).toBe('Held 1 day ago');
    expect(daysToGoText(-21)).toBe('Held 21 days ago');
  });

  it('words lateness only for late tasks', () => {
    expect(lateByText(DAY, DAY)).toBe('');
    expect(lateByText(DAY - 1, DAY)).toBe('1 day late');
    expect(lateByText(DAY - 12, DAY)).toBe('12 days late');
  });
});
