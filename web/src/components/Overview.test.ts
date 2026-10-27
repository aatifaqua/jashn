import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import Overview from './Overview.svelte';

describe('Overview', () => {
  it('shows the verdict, key figures, first actions and notices', async () => {
    const plan = planFor(sampleInput('diwali-mela'));
    const { container } = render(Overview, { props: { plan } });
    expect(screen.getByText(/^Budget:/)).toBeInTheDocument();
    expect(screen.getByText('Volunteers needed')).toBeInTheDocument();
    expect(screen.getByText(`900 of 600 invited`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Do these first' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good to know' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('leaves out volunteers for private events', () => {
    render(Overview, { props: { plan: planFor(sampleInput('kids-birthday')) } });
    expect(screen.queryByText('Volunteers needed')).toBeNull();
  });
});
