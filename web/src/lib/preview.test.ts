import { diffPlans } from '@jashn/core';
import { getProfile } from '@jashn/core/server';
import { describe, expect, it } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import { diffRows, patchRows } from './preview.ts';

const labels = new Map<string, string>(
  getProfile('wedding').categories.map((c) => [c.id, c.label]),
);
const labelOf = (id: string): string => labels.get(id) ?? id;

describe('patchRows', () => {
  const input = sampleInput();

  it('words every changed field and skips unchanged ones', () => {
    const rows = patchRows(
      input,
      {
        invited: 300,
        budget: 1_500_000,
        constraints: ['jain'],
        setting: 'indoor',
        tier: 'metro',
        startTime: '18:30',
        priorities: [],
        date: '2027-03-13',
        style: input.style,
      },
      labelOf,
    );
    expect(rows.map((row) => row.label)).toEqual([
      'Guests invited',
      'Budget',
      'Needs',
      'Setting',
      'City size',
      'Start time',
      'Priorities',
      'Date',
    ]);
    expect(rows[0]).toEqual({ label: 'Guests invited', before: '350', after: '300' });
    expect(rows[1]).toEqual({ label: 'Budget', before: '₹16,00,000', after: '₹15,00,000' });
    expect(rows[2]?.after).toBe('Jain food');
    expect(rows[2]?.before).toBe('Step-free access, Vegetarian food');
    expect(rows[3]).toEqual({ label: 'Setting', before: 'Indoor and outdoor', after: 'Indoor' });
    expect(rows[4]).toEqual({ label: 'City size', before: 'Tier-2 city', after: 'Metro city' });
    expect(rows[5]).toEqual({ label: 'Start time', before: '19:00', after: '18:30' });
    expect(rows[6]?.after).toBe('none');
    expect(rows[7]?.after).toBe('13 Mar 2027');
  });

  it('words wedding functions through the supplied labels', () => {
    const rows = patchRows(input, { functions: ['ceremony'] }, labelOf);
    expect(rows).toEqual([
      { label: 'Functions', before: 'ceremony, mehndi, reception, sangeet', after: 'ceremony' },
    ]);
  });

  it('shows an unparsable date as written', () => {
    const rows = patchRows({ ...input, date: 'soon' }, { date: '2027-03-06' }, labelOf);
    expect(rows[0]?.before).toBe('soon');
  });
});

describe('diffRows', () => {
  it('lists headcount, verdict, budget lines and newly late tasks', () => {
    const before = planFor();
    const after = planFor({ ...sampleInput(), invited: 150 });
    const rows = diffRows(diffPlans(before, after), labelOf);
    expect(rows[0]).toEqual({ label: 'Expected guests', before: '298', after: '128' });
    expect(rows[1]?.label).toBe('Budget verdict');
    const task = before.tasks[0];
    if (task === undefined) throw new Error('fixture has no tasks');
    const late = diffRows(
      {
        expected: { before: 1, after: 1 },
        verdict: { before: 'tight', after: 'tight' },
        budget: [{ category: 'venue', before: 100, after: 200 }],
        newlyLate: [task],
      },
      labelOf,
    );
    expect(late).toEqual([
      { label: 'Venue', before: '₹100', after: '₹200' },
      { label: task.title, before: 'On time', after: 'Late' },
    ]);
  });

  describe('patchRows with an absent value', () => {
    it('skips a key whose value is undefined', () => {
      const patch = { invited: undefined } as unknown as Parameters<typeof patchRows>[1];
      expect(patchRows(sampleInput(), patch, labelOf)).toEqual([]);
    });
  });
});
