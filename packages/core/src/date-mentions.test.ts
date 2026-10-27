import { describe, expect, it } from 'vitest';
import { asciiDigits, inventedDates, planDays } from './date-mentions.ts';
import { fromCivil } from './days.ts';
import { EVENT_DAY, samplePlan } from './fallback/plan.fixture.ts';
import { TODAY } from './test-fixtures.ts';

describe('planDays', () => {
  it('collects today, the function days, tasks, vendors, payments and the run sheet', () => {
    const days = planDays(samplePlan());
    expect(days.has(TODAY)).toBe(true);
    expect(days.has(EVENT_DAY)).toBe(true);
    // The mehndi falls the day before the ceremony and the reception the day after.
    expect(days.has(EVENT_DAY - 1)).toBe(true);
    expect(days.has(EVENT_DAY + 1)).toBe(true);
    expect(days.has(TODAY + 10)).toBe(true);
    expect(days.has(EVENT_DAY + 3)).toBe(true);
    expect(days.has(EVENT_DAY - 7)).toBe(true);
    expect(days.has(TODAY + 5)).toBe(false);
  });

  it('adds a proposed date and ignores a malformed one', () => {
    const plan = samplePlan();
    expect(planDays(plan, { date: '2027-03-13' }).has(fromCivil(2027, 3, 13))).toBe(true);
    expect(planDays(plan, { date: 'soon' }).size).toBe(planDays(plan).size);
    expect(planDays(plan, { invited: 10 }).size).toBe(planDays(plan).size);
  });
});

describe('inventedDates', () => {
  const allowed = new Set([fromCivil(2027, 2, 20), fromCivil(2026, 11, 6)]);

  it.each([
    'The wedding is on 20 February 2027.',
    'Saturday, 20 Feb 2027',
    'February 20, 2027',
    'Feb. 20',
    'by the 6th of November',
    'Nov 6 at the latest',
    '2027-02-20',
    '20 फ़रवरी को शादी है',
    '6 नवंबर तक',
    'Lunch at 1 pm, 350 guests, 4 marigold garlands, sangeet in March 2027',
    'Of your guests, about 20 may need step-free seating; 7 may bring children.',
    'Elders may 2 hours rest between functions.',
    'Mehndi on 20 Feb 1500 guests expected, sangeet 20 Feb, 1800 hrs',
    'Please confirm by 06/11/2026 or 20-02-2027.',
    '६ नवंबर तक भुगतान करें',
  ])('accepts plan dates and non-dates: %s', (text) => {
    expect(inventedDates(text, allowed)).toEqual([]);
  });

  it.each([
    ['Pay by 21 February 2027.', ['21 February 2027']],
    ['The event is on 20 February 2028.', ['20 February 2028']],
    ['Book by March 3rd', ['March 3rd']],
    ['Confirm by 2026-11-07', ['2026-11-07']],
    ['31 Feb', ['31 Feb']],
    ['2027-13-01', ['2027-13-01']],
    ['7 नवंबर तक', ['7 नवंबर']],
    ['Sept 30 and 1 Dec', ['1 Dec', 'Sept 30']],
    ['20 May', ['20 May']],
    ['Please confirm by 07/11/2026.', ['07/11/2026']],
    ['Due 13.13.2026', ['13.13.2026']],
    ['भुगतान ७ नवंबर तक', ['7 नवंबर']],
  ])('reports dates the plan does not state: %s', (text, expected) => {
    expect(inventedDates(text, allowed)).toEqual(expected);
  });

  it('accepts 29 February without a year only when the plan has it', () => {
    expect(inventedDates('29 Feb', new Set([fromCivil(2028, 2, 29)]))).toEqual([]);
    expect(inventedDates('29 Feb', allowed)).toEqual(['29 Feb']);
  });
});

describe('asciiDigits', () => {
  it('turns Devanagari digits into ASCII and leaves everything else alone', () => {
    expect(asciiDigits('₹१,६०,००० और ६ नवंबर, 7 Dec')).toBe('₹1,60,000 और 6 नवंबर, 7 Dec');
  });
});
