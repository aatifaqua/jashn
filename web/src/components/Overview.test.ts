import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { TODAY, planFor, sampleInput } from '../test-fixtures.ts';
import Overview from './Overview.svelte';

const NONE: ReadonlySet<string> = new Set();

describe('Overview', () => {
  it('shows the verdict, key figures, first actions and notices', async () => {
    const plan = planFor(sampleInput('diwali-mela'));
    const { container } = render(Overview, { props: { plan, checks: NONE, today: TODAY } });
    expect(screen.getByText(/^Budget:/)).toBeInTheDocument();
    expect(screen.getByText('Volunteers needed')).toBeInTheDocument();
    expect(screen.getByText(`900 of 600 invited`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Do these first' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good to know' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('leaves out volunteers for private events', () => {
    const plan = planFor(sampleInput('kids-birthday'));
    render(Overview, { props: { plan, checks: NONE, today: TODAY } });
    expect(screen.queryByText('Volunteers needed')).toBeNull();
  });

  it('drops ticked tasks from "Do these first" and moves the next ones up', () => {
    const plan = planFor();
    const [first] = plan.topActions;
    if (first === undefined) throw new Error('expected a top action');
    render(Overview, { props: { plan, checks: new Set([first.id]), today: TODAY } });
    const list = screen.getByRole('heading', { name: 'Do these first' }).parentElement;
    expect(list?.textContent).not.toContain(first.title);
    expect(list?.querySelectorAll('.action')).toHaveLength(3);
  });

  it('counts down with the real today, so a held event says how long ago', () => {
    const plan = planFor();
    const eventDay = plan.today + plan.daysToGo;
    render(Overview, { props: { plan, checks: NONE, today: eventDay + 21 } });
    expect(screen.getByText('Held 21 days ago')).toBeInTheDocument();
  });
});
