import { getProfile } from '@jashn/core';
import { render, screen, within } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { planFor } from '../test-fixtures.ts';
import BudgetChart from './BudgetChart.svelte';

const profile = getProfile('wedding');
const labels = new Map<string, string>([
  ...profile.categories.map((c) => [c.id, c.label] as const),
  ...profile.functions.map((f) => [f.id, f.label] as const),
]);
const labelOf = (id: string): string => labels.get(id) ?? id;

describe('BudgetChart', () => {
  const plan = planFor();
  const props = {
    lines: plan.budget,
    contingency: plan.contingency,
    total: plan.input.budget,
    labelOf,
  };

  it('draws one labelled SVG image with a bar per line plus contingency', async () => {
    const { container } = render(BudgetChart, { props });
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toMatch(/^Budget split of ₹16,00,000: .*Contingency \d+%\.$/);
    expect(container.querySelectorAll('rect.bar')).toHaveLength(plan.budget.length + 1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('carries every figure in a captioned table, with per-function slices', () => {
    render(BudgetChart, { props });
    const table = screen.getByRole('table', { name: /Budget split of ₹16,00,000/ });
    expect(within(table).getAllByRole('row')).toHaveLength(plan.budget.length + 3);
    expect(within(table).getByText('Total')).toBeInTheDocument();
    expect(within(table).getAllByText(/Mehndi ₹/).length).toBeGreaterThan(0);
  });
});
