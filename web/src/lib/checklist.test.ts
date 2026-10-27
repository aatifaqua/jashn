import { describe, expect, it } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import { checklistText } from './checklist.ts';

describe('checklistText', () => {
  it('lists every task by phase with ticks for done ones', () => {
    const plan = planFor(sampleInput('kids-birthday'));
    const first = plan.tasks.find((task) => task.status !== 'done');
    const booked = plan.tasks.find((task) => task.status === 'done');
    if (first === undefined || booked === undefined) throw new Error('fixture changed');
    const text = checklistText(plan, new Set([first.id]));
    expect(text.split('\n')[0]).toMatch(/^Jashn checklist: children's birthday party, \w+day, /);
    expect(text).toContain(`[x] ${first.title} (due `);
    expect(text).toContain(`[x] ${booked.title}`);
    expect(text).toContain('Do now');
    expect(text.match(/^\[[ x]\]/gm)).toHaveLength(plan.tasks.length);
  });
});
