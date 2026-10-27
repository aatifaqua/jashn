import { describe, expect, it } from 'vitest';
import { expectedHeadcount } from './attendance.ts';
import { deriveContext } from './context.ts';
import { costFloor, verdictFor } from './feasibility.ts';
import { getProfile } from './profiles/index.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import { rankTrims } from './trims.ts';
import type { BudgetLine, EventInput, Trim } from './types.ts';

function line(category: string, amount: number): BudgetLine {
  return { category, amount, share: 0, reasons: [] };
}

const WEDDING_LINES = [
  line('venue', 400_000),
  line('catering', 800_000),
  line('decor', 200_000),
  line('invitations', 50_000),
];

function trims(overrides: Partial<EventInput>, lines = WEDDING_LINES): Trim[] {
  const input = sampleInput(overrides);
  const profile = getProfile(input.type);
  const ctx = deriveContext(input, TODAY, profile);
  const floor = costFloor(input, profile);
  const verdict = verdictFor(input.budget, ctx.expected, floor);
  return rankTrims({ input, profile, ctx, lines, floor, verdict });
}

function byId(list: readonly Trim[], id: string): Trim | undefined {
  return list.find((item) => item.id === id);
}

describe('rankTrims', () => {
  it('ranks every applicable wedding trim by saving', () => {
    const list = trims({ budget: 500_000 });
    expect(list.map((item) => [item.id, item.saves])).toEqual([
      ['invite-fewer', 338_800],
      ['lunch', 120_000],
      ['e-invites', 40_000],
      ['weekday', 40_000],
    ]);
  });

  it('invites fewer to reach the floor when unrealistic', () => {
    const input = { budget: 500_000 };
    const fewer = byId(trims(input), 'invite-fewer');
    expect(fewer?.label).toBe('Invite 172 guests instead of 300');
    expect(fewer?.reasons[0]?.text).toBe(
      'About 147 would attend, giving ₹3,401 per guest: at least the modest minimum of ₹3,400 for a tier-2 city wedding.',
    );
    const attend = expectedHeadcount(sampleInput({ invited: 172 }), getProfile('wedding'));
    expect(verdictFor(input.budget, attend, 3400)).toBe('tight');
    expect(verdictFor(input.budget, attend + 1, 3400)).toBe('unrealistic');
  });

  it('invites fewer to reach comfort when tight', () => {
    const fewer = byId(trims({ invited: 900, budget: 3_000_000 }), 'invite-fewer');
    expect(fewer?.label).toBe('Invite 691 guests instead of 900');
    expect(fewer?.reasons[0]?.text).toContain('a comfortable margin above the minimum');
    const attend = expectedHeadcount(sampleInput({ invited: 691 }), getProfile('wedding'));
    expect(verdictFor(3_000_000, attend, 3400)).toBe('comfortable');
    expect(verdictFor(3_000_000, attend + 1, 3400)).toBe('tight');
  });

  it('skips inviting fewer when no smaller list helps', () => {
    expect(byId(trims({}), 'invite-fewer')).toBeUndefined();
    expect(byId(trims({ budget: 1000, invited: 2 }), 'invite-fewer')).toBeUndefined();
  });

  it('skips the weekday trim midweek and lunch for daytime starts', () => {
    const list = trims({ date: '2027-02-17', startTime: '12:00' });
    expect(byId(list, 'weekday')).toBeUndefined();
    expect(byId(list, 'lunch')).toBeUndefined();
  });

  it('skips the weekday trim once the venue is booked for the date', () => {
    expect(byId(trims({ budget: 900_000 }), 'weekday')).toBeDefined();
    expect(byId(trims({ budget: 900_000, venueBooked: true }), 'weekday')).toBeUndefined();
  });

  it('merges the two smallest functions held before the ceremony', () => {
    const list = trims({ functions: ['ceremony', 'haldi', 'sangeet', 'reception'] });
    expect(byId(list, 'merge-functions')?.label).toBe('Hold the haldi and sangeet on one day');
    expect(byId(trims({ functions: ['ceremony', 'mehndi'] }), 'merge-functions')).toBeUndefined();
  });

  it('never merges a pre-wedding function with the reception', () => {
    for (const style of ['traditional', 'intimate'] as const) {
      const list = trims({
        style,
        budget: 900_000,
        functions: ['ceremony', 'mehndi', 'reception'],
      });
      expect(byId(list, 'merge-functions')).toBeUndefined();
    }
  });

  it('skips e-invites when the event is already eco-friendly', () => {
    expect(byId(trims({ constraints: ['eco-friendly'] }), 'e-invites')).toBeUndefined();
  });

  it('sets a sponsorship target equal to the shortfall for community events', () => {
    const lines = [line('venue', 6000), line('food', 12_000), line('infrastructure', 14_000)];
    const mela = {
      type: 'community',
      style: 'festival',
      functions: [],
      tier: 'metro',
      invited: 800,
      budget: 60_000,
    } as const;
    const list = trims(mela, lines);
    expect(list[0]).toEqual({
      id: 'sponsorship',
      label: 'Raise ₹1,20,000 from sponsors',
      saves: 120_000,
      reasons: [
        {
          code: 'sponsorship',
          text: 'About 1,200 people at ₹150 each need ₹1,80,000; your budget is ₹60,000.',
        },
      ],
    });
    expect(byId(trims({ ...mela, budget: 500_000 }, lines), 'sponsorship')).toBeUndefined();
    expect(byId(trims({ budget: 500_000 }), 'sponsorship')).toBeUndefined();
  });

  it('drops trims that would save nothing', () => {
    expect(trims({}, [])).toEqual([]);
  });
});
