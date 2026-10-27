import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import TaskList from './TaskList.svelte';

const downloadCalendar = vi.fn();
vi.mock('../lib/calendar.ts', () => ({ downloadCalendar }));

afterEach(() => {
  downloadCalendar.mockReset();
});

describe('TaskList', () => {
  const plan = planFor(sampleInput('kids-birthday'));

  it('groups tasks by phase with real checkboxes and status badges', async () => {
    const ontoggle = vi.fn();
    const open = plan.tasks.find((task) => task.status !== 'done');
    if (open === undefined) throw new Error('fixture changed');
    const { container } = render(TaskList, {
      props: { plan, planId: 'plan-1', checks: new Set<string>(), ontoggle },
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
      props: { plan, planId: 'plan-1', checks: new Set([open.id]), ontoggle: vi.fn() },
    });
    expect(screen.getByRole('checkbox', { name: open.title })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: booked.title })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: booked.title })).toBeDisabled();
  });

  it('loads the calendar writer on click and reports the outcome', async () => {
    render(TaskList, {
      props: { plan, planId: 'plan-1', checks: new Set<string>(), ontoggle: vi.fn() },
    });
    const button = screen.getByRole('button', { name: /Add to calendar/ });
    await fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/downloaded/);
    });
    expect(downloadCalendar).toHaveBeenCalledWith(plan, 'plan-1', new Set<string>());
    // The same outcome twice is announced twice: the status empties before it is set again.
    const seen: string[] = [];
    const status = screen.getByRole('status');
    new MutationObserver(() => seen.push(status.textContent)).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    await fireEvent.click(button);
    await waitFor(() => {
      expect(seen.at(-1)).toMatch(/downloaded/);
    });
    expect(seen).toContain('');
    downloadCalendar.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    await fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Could not create/);
    });
  });
});
