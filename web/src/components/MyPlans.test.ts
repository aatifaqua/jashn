import { fireEvent, render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TODAY, sampleInput, savedPlan } from '../test-fixtures.ts';
import type { SavedPlan } from '../lib/storage.ts';
import MyPlans from './MyPlans.svelte';

function setup(
  plans = [savedPlan(), savedPlan({ id: 'plan-2', input: sampleInput('kids-birthday') })],
  today = TODAY,
) {
  const handlers = { onopen: vi.fn(), ondelete: vi.fn(), onclear: vi.fn() };
  const view = render(MyPlans, { props: { plans, today, ...handlers } });
  return { ...view, ...handlers };
}

describe('MyPlans', () => {
  it('lists saved plans with open and delete controls', async () => {
    const { container, onopen, ondelete } = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Traditional wedding in Lucknow' }));
    expect(onopen).toHaveBeenCalledWith('plan-1');
    await fireEvent.click(
      screen.getByRole('button', { name: /^Delete Children's birthday party in Pune/ }),
    );
    expect(ondelete).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Yes, delete' });
    expect(document.activeElement).toBe(confirm);
    await fireEvent.click(confirm);
    expect(ondelete).toHaveBeenCalledWith('plan-2');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('asks for confirmation before clearing everything', async () => {
    const { onclear } = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Clear all my data' }));
    expect(screen.getByRole('group', { name: /cannot be undone/ })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onclear).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Clear all my data' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, clear all my data' }));
    expect(onclear).toHaveBeenCalledOnce();
  });

  it('moves focus to the next row after a delete, and to the heading once the list is empty', async () => {
    const first = savedPlan();
    const second = savedPlan({ id: 'plan-2', input: sampleInput('kids-birthday') });
    const handlers = { onopen: vi.fn(), onclear: vi.fn() };
    let plans: SavedPlan[] = [first, second];
    const view = render(MyPlans, {
      props: {
        plans,
        today: TODAY,
        ...handlers,
        ondelete: (id: string) => {
          plans = plans.filter((plan) => plan.id !== id);
          void view.rerender({ plans });
        },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /^Delete Traditional wedding/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await vi.waitFor(() => {
      expect(document.activeElement?.textContent).toContain("Children's birthday party");
    });
    await fireEvent.click(screen.getByRole('button', { name: /^Delete Children/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'My plans' }));
    });
  });

  it('marks events that have already been held as past', () => {
    const plan = savedPlan();
    const held = TODAY + 400;
    setup([plan], held);
    expect(screen.getByText('Past')).toBeInTheDocument();
  });

  it('explains where plans are kept when there are none', () => {
    setup([]);
    expect(screen.getByText(/saved in this browser only/)).toBeInTheDocument();
  });

  it('titles a plan without a city by its occasion and shows an unparsable date as written', () => {
    setup([savedPlan({ input: { ...sampleInput(), city: '', date: 'someday' } })]);
    expect(screen.getByRole('button', { name: 'Traditional wedding' })).toBeInTheDocument();
    expect(screen.getByText('someday')).toBeInTheDocument();
  });
});
