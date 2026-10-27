import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { planFor } from '../test-fixtures.ts';
import LiveSummary from './LiveSummary.svelte';

describe('LiveSummary', () => {
  it('shows days to go, expected guests and the verdict in a polite live region', async () => {
    const plan = planFor();
    const { container } = render(LiveSummary, { props: { plan } });
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByText(`${String(plan.daysToGo)} days to go`)).toBeInTheDocument();
    expect(screen.getByText('298')).toBeInTheDocument();
    expect(screen.getByText('Tight')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('asks for the missing facts when there is no plan yet', () => {
    render(LiveSummary, { props: { plan: null } });
    expect(screen.getByText(/Add a date, guest count and budget/)).toBeInTheDocument();
  });
});
