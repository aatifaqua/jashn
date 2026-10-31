import { fireEvent, render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import TaskList from './TaskList.svelte';

describe('TaskList', () => {
  const plan = planFor(sampleInput('kids-birthday'));

  it('groups tasks by phase with real checkboxes and status badges', async () => {
    const ontoggle = vi.fn();
    const open = plan.tasks.find((task) => task.status !== 'done');
    if (open === undefined) throw new Error('fixture changed');
    const { container } = render(TaskList, {
      props: { plan, checks: new Set<string>(), ontoggle },
    });
    expect(screen.getByRole('heading', { name: 'Do now' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(plan.tasks.length);
    const box = screen.getByRole('checkbox', { name: open.title });
    await fireEvent.click(box);
    expect(ontoggle).toHaveBeenCalledWith(open.id, true);
    expect(screen.getAllByText(/days? late$/).length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows ticked and already-done tasks as checked; done ones cannot be unticked', () => {
    const open = plan.tasks.find((task) => task.status !== 'done');
    const booked = plan.tasks.find((task) => task.status === 'done');
    if (open === undefined || booked === undefined) throw new Error('fixture changed');
    render(TaskList, {
      props: { plan, checks: new Set([open.id]), ontoggle: vi.fn() },
    });
    expect(screen.getByRole('checkbox', { name: open.title })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: booked.title })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: booked.title })).toBeDisabled();
  });
});
