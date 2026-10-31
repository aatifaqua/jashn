import { describe, expect, it } from 'vitest';
import { fromIso } from './days.ts';
import {
  formatCount,
  formatDay,
  formatLongDay,
  formatRupees,
  formatShortIso,
  occasion,
  weekdayName,
  withArticle,
} from './text.ts';

describe('text', () => {
  it('groups numbers the Indian way', () => {
    expect(formatCount(250_000)).toBe('2,50,000');
    expect(formatCount(999)).toBe('999');
    expect(formatRupees(10_000_000)).toBe('₹1,00,00,000');
  });

  it('formats day numbers without time-zone drift', () => {
    expect(formatDay(fromIso('2027-02-20') ?? 0)).toBe('20 Feb 2027');
    expect(formatDay(0)).toBe('1 Jan 1970');
    expect(weekdayName(fromIso('2027-02-20') ?? 0)).toBe('Saturday');
    expect(weekdayName(0)).toBe('Thursday');
  });
});

describe('sentence helpers', () => {
  const day = fromIso('2027-02-20') ?? 0;

  it('formats long and short dates from day numbers and ISO dates alike', () => {
    expect(formatLongDay(day)).toBe('Saturday, 20 February 2027');
    expect(formatShortIso('2027-02-20')).toBe('20 Feb');
  });

  it('names the occasion with the right article', () => {
    expect(withArticle(occasion({ type: 'wedding', style: 'intimate' }))).toBe(
      'an intimate wedding',
    );
    expect(withArticle(occasion({ type: 'birthday', style: 'milestone' }))).toBe(
      'a milestone birthday',
    );
    expect(occasion({ type: 'community', style: 'unknown' })).toBe('community event');
    expect(occasion({ type: 'birthday', style: 'unknown' })).toBe('birthday');
  });
});
