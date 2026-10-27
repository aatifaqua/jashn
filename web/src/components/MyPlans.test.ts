import { fireEvent, render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { sampleInput, savedPlan } from '../test-fixtures.ts';
import MyPlans from './MyPlans.svelte';

function setup(
  plans = [savedPlan(), savedPlan({ id: 'plan-2', input: sampleInput('kids-birthday') })],
) {
  const handlers = { onopen: vi.fn(), ondelete: vi.fn(), onclear: vi.fn() };
  const view = render(MyPlans, { props: { plans, ...handlers } });
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
