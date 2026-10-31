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

  it('shows the verdict as an icon and a word, never colour alone', async () => {
    const plan = planFor();
    const feasibility = { verdict: 'tight', perGuest: 4027, floor: 3500, trims: [] } as const;
    const props = { plan: { ...plan, feasibility }, checks: NONE, today: TODAY };
    const { container, rerender } = render(Overview, { props });
    const icon = (): string | null | undefined =>
      container.querySelector('.verdict-head use')?.getAttribute('href');
    expect(screen.getByText('Tight')).toBeInTheDocument();
    expect(icon()).toBe('#i-alert');
    expect(screen.getByText(/₹4,027 per expected guest/)).toBeInTheDocument();
    await rerender({
      ...props,
      plan: { ...plan, feasibility: { ...feasibility, verdict: 'unrealistic' } },
    });
    expect(screen.getByText('Unrealistic')).toBeInTheDocument();
    expect(icon()).toBe('#i-stop');
  });

  it('lists the first actions with status and a Why? disclosure each', () => {
    const plan = planFor();
    const { container } = render(Overview, { props: { plan, checks: NONE, today: TODAY } });
    const actions = container.querySelectorAll('.action');
    expect(actions).toHaveLength(plan.topActions.length);
    for (const action of actions) expect(action.textContent).toContain('Why?');
    expect(screen.getAllByText(/days? late$/).length).toBeGreaterThan(0);
  });

  it('says when nothing needs doing', () => {
    const plan = planFor();
    const all = new Set(plan.tasks.map((task) => task.id));
    render(Overview, { props: { plan, checks: all, today: TODAY } });
    expect(screen.getByText(/nothing needs doing yet/)).toBeInTheDocument();
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
