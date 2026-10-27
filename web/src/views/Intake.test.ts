import { getProfile, toIso } from '@jashn/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage, TODAY, makeStore, sampleInput, savedPlan } from '../test-fixtures.ts';
import { PlanStore } from '../lib/plans.svelte.ts';
import { writePlans } from '../lib/storage.ts';
import Intake from './Intake.svelte';

function setup(store: PlanStore = makeStore(), editing = false) {
  const ondone = vi.fn();
  const oncancel = vi.fn();
  const view = render(Intake, {
    props: { store, editing, focusHeading: true, ondone, oncancel },
  });
  return { ...view, store, ondone, oncancel };
}

async function type(label: RegExp | string, value: string): Promise<void> {
  await fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

describe('Intake', () => {
  it('shows the start screen: heading, samples, saved plans and three fieldsets', async () => {
    const { container } = setup();
    const heading = screen.getByRole('heading', { level: 1, name: 'Plan your celebration' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('heading', { name: 'Try a sample' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My plans' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /The event/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Place and people/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Money and needs/ })).toBeInTheDocument();
    await screen.findByRole('radio', { name: 'Traditional' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows inline errors and focuses the error summary on a failed submit', async () => {
    const { container, ondone } = setup();
    await screen.findByRole('radio', { name: 'Traditional' });
    await fireEvent.click(screen.getByRole('button', { name: 'Make my plan' }));
    const summary = await screen.findByRole('heading', { name: /Please fix these/ });
    expect(document.activeElement).toBe(summary.parentElement);
    expect(screen.getByLabelText('Date')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Guests invited')).toHaveAccessibleDescription(
      /Guests invited is required/,
    );
    expect(ondone).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();

    await type('Date', toIso(TODAY + 60));
    await type('Guests invited', '120');
    await type(/Total budget/, '9,00,000');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Please fix/ })).toBeNull();
    });
  });

  it('updates the live summary and creates the plan from a valid form', async () => {
    const { store, ondone } = setup();
    await screen.findByRole('radio', { name: 'Traditional' });
    await type('City', 'Jaipur');
    await type('Date', toIso(TODAY + 90));
    await type('Guests invited', '200');
    await type(/Total budget/, '12,00,000');
    await waitFor(() => {
      expect(screen.getByText('170')).toBeInTheDocument();
    });
    expect(screen.getByText('90 days to go')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Make my plan' }));
    await waitFor(() => {
      expect(ondone).toHaveBeenCalledOnce();
    });
    expect(store.current?.input).toMatchObject({ city: 'Jaipur', invited: 200, budget: 1_200_000 });
  });

  it('switches event type and style with their defaults', async () => {
    setup();
    await screen.findByRole('radio', { name: 'Traditional' });
    await fireEvent.click(screen.getByRole('radio', { name: /Community event/ }));
    const festival = await screen.findByRole('radio', { name: /Festival/ });
    expect(festival).toBeChecked();
    expect(screen.queryByRole('group', { name: 'Functions' })).toBeNull();
    await fireEvent.click(screen.getByRole('radio', { name: /Meetup/ }));
    expect(screen.getByRole('radio', { name: /Meetup/ })).toBeChecked();
  });

  it('opens a sample in one click', async () => {
    const { store, ondone } = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Diwali mela' }));
    await waitFor(() => {
      expect(ondone).toHaveBeenCalledOnce();
    });
    expect(store.current?.input.type).toBe('community');
  });

  it('opens and deletes saved plans', async () => {
    const store = makeStore();
    await store.create(sampleInput('kids-birthday'));
    await store.create(sampleInput());
    store.close();
    const { ondone } = setup(store);
    await fireEvent.click(screen.getByRole('button', { name: /^Children's birthday party/ }));
    await waitFor(() => {
      expect(ondone).toHaveBeenCalledOnce();
    });
    expect(store.current?.input.type).toBe('birthday');
    await fireEvent.click(screen.getByRole('button', { name: /^Delete Traditional wedding/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(store.plans).toHaveLength(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Clear all my data' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, clear all my data' }));
    expect(store.plans).toHaveLength(0);
  });

  it('edits the open plan with the form prefilled', async () => {
    const store = makeStore();
    await store.create(sampleInput());
    const { ondone, oncancel } = setup(store, true);
    expect(screen.getByRole('heading', { level: 1, name: 'Edit your event' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Try a sample' })).toBeNull();
    expect(screen.getByLabelText('City')).toHaveValue('Lucknow');
    await screen.findByRole('radio', { name: 'Traditional' });
    await type('Guests invited', '300');
    await fireEvent.click(screen.getByRole('button', { name: 'Update my plan' }));
    await waitFor(() => {
      expect(ondone).toHaveBeenCalledOnce();
    });
    expect(store.current?.input.invited).toBe(300);
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(oncancel).toHaveBeenCalledOnce();
  });

  it('shows a profile loading error from the store', async () => {
    const store = makeStore();
    store.error = 'Could not load the planner for this event type.';
    setup(store);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load/);
  });

  it('retries the plan that failed to open, not just the form type', async () => {
    const storage = new MemoryStorage();
    writePlans(storage, [savedPlan()]);
    let online = false;
    const store = new PlanStore({
      storage,
      today: TODAY,
      loadProfile: (type) =>
        online ? Promise.resolve(getProfile(type)) : Promise.reject(new Error('offline')),
    });
    const { ondone } = setup(store);
    await fireEvent.click(screen.getByRole('button', { name: 'Traditional wedding in Lucknow' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load/);
    online = true;
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(ondone).toHaveBeenCalledOnce();
    });
    expect(store.currentId).toBe(savedPlan().id);
  });

  it('retries loading the form type when nothing else failed', async () => {
    let online = false;
    const store = new PlanStore({
      storage: null,
      today: TODAY,
      loadProfile: (type) =>
        online ? Promise.resolve(getProfile(type)) : Promise.reject(new Error('offline')),
    });
    const { ondone } = setup(store);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load/);
    online = true;
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('radio', { name: 'Traditional' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(ondone).not.toHaveBeenCalled();
  });

  it('lets a held event be edited without moving its date', async () => {
    const store = makeStore();
    await store.create(sampleInput());
    const eventDay = (store.plan?.today ?? 0) + (store.plan?.daysToGo ?? 0);
    store.setToday(eventDay + 10);
    const { ondone } = setup(store, true);
    await screen.findByRole('radio', { name: 'Traditional' });
    await type('Guests invited', '280');
    await fireEvent.click(screen.getByRole('button', { name: 'Update my plan' }));
    await waitFor(() => {
      expect(ondone).toHaveBeenCalledOnce();
    });
    expect(store.current?.input.invited).toBe(280);
  });

  it('stays put when a plan cannot be made or opened', async () => {
    const storage = new MemoryStorage();
    writePlans(storage, [savedPlan()]);
    const store = new PlanStore({
      storage,
      today: TODAY,
      loadProfile: () => Promise.reject(new Error('offline')),
    });
    const { ondone } = setup(store);
    await fireEvent.click(screen.getByRole('button', { name: '7th birthday' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Traditional wedding in Lucknow' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load/);
    expect(ondone).not.toHaveBeenCalled();
  });
});
