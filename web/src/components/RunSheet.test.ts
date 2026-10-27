import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { planFor } from '../test-fixtures.ts';
import RunSheet from './RunSheet.svelte';

describe('RunSheet', () => {
  it('renders one captioned table per day', async () => {
    const plan = planFor();
    const days = new Set(plan.runSheet.map((slot) => slot.day));
    const { container } = render(RunSheet, { props: { slots: plan.runSheet } });
    expect(screen.getAllByRole('table')).toHaveLength(days.size);
    expect(days.size).toBeGreaterThan(1);
    const first = plan.runSheet[0];
    if (first === undefined) throw new Error('fixture has no slots');
    expect(screen.getAllByText(first.title).length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says so when there is nothing to run', () => {
    render(RunSheet, { props: { slots: [] } });
    expect(screen.getByText(/No run sheet/)).toBeInTheDocument();
  });
});
