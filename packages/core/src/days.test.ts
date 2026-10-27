import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addYears,
  daysInMonth,
  formatTime,
  fromCivil,
  fromIso,
  indiaDay,
  month,
  parseTime,
  toCivil,
  toIso,
  weekday,
} from './days.ts';

const MS_PER_DAY = 86_400_000;

describe('fromIso / toIso', () => {
  it('maps the epoch and known dates', () => {
    expect(fromIso('1970-01-01')).toBe(0);
    expect(fromIso('2026-10-27')).toBe(Date.UTC(2026, 9, 27) / MS_PER_DAY);
    expect(fromIso('1969-12-31')).toBe(-1);
    expect(toIso(0)).toBe('1970-01-01');
    expect(toIso(-1)).toBe('1969-12-31');
  });

  it('accepts leap days only in leap years', () => {
    expect(fromIso('2028-02-29')).not.toBeNull();
    expect(fromIso('2000-02-29')).not.toBeNull();
    expect(fromIso('2027-02-29')).toBeNull();
    expect(fromIso('1900-02-29')).toBeNull();
  });

  it.each(['2026-13-01', '2026-00-10', '2026-04-31', '2026-04-00', '26-04-01', '2026-4-1', ''])(
    'rejects %j',
    (value) => {
      expect(fromIso(value)).toBeNull();
    },
  );

  it('round-trips every day across four centuries, matching Date.UTC', () => {
    fc.assert(
      fc.property(fc.integer({ min: -200_000, max: 200_000 }), (day) => {
        const iso = toIso(day);
        expect(fromIso(iso)).toBe(day);
        expect(iso).toBe(new Date(day * MS_PER_DAY).toISOString().slice(0, 10));
      }),
    );
  });
});

describe('civil helpers', () => {
  it('splits and joins calendar dates', () => {
    expect(toCivil(fromCivil(2026, 1, 15))).toEqual({ year: 2026, month: 1, day: 15 });
    expect(toCivil(fromCivil(2026, 12, 31))).toEqual({ year: 2026, month: 12, day: 31 });
  });

  it('knows month lengths', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 7)).toBe(31);
  });

  it('reports the month of a day', () => {
    expect(month(fromCivil(2026, 2, 1))).toBe(2);
    expect(month(fromCivil(2026, 11, 30))).toBe(11);
  });
});

describe('weekday and addDays', () => {
  it('numbers weekdays from Sunday, also before the epoch', () => {
    expect(weekday(0)).toBe(4);
    expect(weekday(-1)).toBe(3);
    expect(weekday(-5)).toBe(6);
    expect(weekday(fromCivil(2026, 10, 25))).toBe(0);
  });

  it('matches Date#getUTCDay for any day', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100_000, max: 100_000 }), (day) => {
        expect(weekday(day)).toBe(new Date(day * MS_PER_DAY).getUTCDay());
      }),
    );
  });

  it('adds and subtracts days', () => {
    expect(addDays(10, 5)).toBe(15);
    expect(addDays(10, -12)).toBe(-2);
  });
});

describe('addYears', () => {
  it('keeps the calendar date and falls back from 29 February', () => {
    expect(toIso(addYears(fromCivil(2028, 3, 1), 3))).toBe('2031-03-01');
    expect(toIso(addYears(fromCivil(2028, 2, 29), 3))).toBe('2031-02-28');
    expect(toIso(addYears(fromCivil(2027, 2, 28), 1))).toBe('2028-02-28');
  });

  it('is exactly three calendar years on either side of any leap day', () => {
    fc.assert(
      fc.property(fc.integer({ min: fromCivil(2000, 1, 1), max: fromCivil(2100, 1, 1) }), (day) => {
        const later = toCivil(addYears(day, 3));
        const now = toCivil(day);
        expect(later.year).toBe(now.year + 3);
        expect(later.month).toBe(now.month);
        expect(later.day).toBe(Math.min(now.day, daysInMonth(now.year + 3, now.month)));
      }),
    );
  });
});

describe('indiaDay', () => {
  it('turns over at midnight in India, not at midnight UTC', () => {
    expect(indiaDay(Date.UTC(2026, 9, 26, 18, 29))).toBe(fromIso('2026-10-26'));
    expect(indiaDay(Date.UTC(2026, 9, 26, 18, 30))).toBe(fromIso('2026-10-27'));
    expect(indiaDay(Date.UTC(2026, 9, 27, 18, 29))).toBe(fromIso('2026-10-27'));
  });
});

describe('parseTime / formatTime', () => {
  it('parses valid 24-hour times', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('18:30')).toBe(1110);
    expect(parseTime('23:59')).toBe(1439);
  });

  it.each(['24:00', '7:00', '07:60', '07-00', '', '07:00 '])('rejects %j', (value) => {
    expect(parseTime(value)).toBeNull();
  });

  it('formats and wraps past midnight in both directions', () => {
    expect(formatTime(1110)).toBe('18:30');
    expect(formatTime(1440 + 65)).toBe('01:05');
    expect(formatTime(-30)).toBe('23:30');
  });

  it('round-trips every minute of the day', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1439 }), (minutes) => {
        expect(parseTime(formatTime(minutes))).toBe(minutes);
      }),
    );
  });
});
