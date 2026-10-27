import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { planFor } from '../test-fixtures.ts';
import TrimList from './TrimList.svelte';

describe('TrimList', () => {
  it('lists savings largest first with their amounts', async () => {
    const { trims } = planFor().feasibility;
    const first = trims[0];
    if (first === undefined) throw new Error('fixture has no trims');
    const { container } = render(TrimList, { props: { trims } });
    expect(screen.getByText(first.label)).toBeInTheDocument();
    expect(screen.getAllByText(/saves about ₹/)).toHaveLength(trims.length);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says when no savings are needed', () => {
    render(TrimList, { props: { trims: [] } });
    expect(screen.getByText(/no savings are needed/)).toBeInTheDocument();
  });
});
