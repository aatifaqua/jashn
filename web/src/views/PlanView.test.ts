import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PLAN_TABS } from '../lib/tabs.ts';
import type { GenAi } from '../lib/genai.ts';
import { fakeGenAi, makeStore, sampleInput } from '../test-fixtures.ts';
import PlanView from './PlanView.svelte';

async function setup(genai: GenAi | null = fakeGenAi()) {
  const store = makeStore();
  await store.create(sampleInput('kids-birthday'));
  const { current: entry, plan, profile } = store;
  if (entry === null || plan === null || profile === null) throw new Error('store not ready');
  const print = vi.fn();
  const onedit = vi.fn();
  const view = render(PlanView, {
    props: {
      store,
      entry,
      plan,
      profile,
      genai: genai ?? undefined,
      focusHeading: true,
      page: { origin: 'https://jashn.example', pathname: '/' },
      print,
      onedit,
    },
  });
  return { ...view, store, print, onedit };
}

function tab(name: string): HTMLElement {
  return screen.getByRole('tab', { name });
}

describe('PlanView', () => {
  it('opens on the overview with the title focused and no axe violations', async () => {
    const { container } = await setup();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent("Children's birthday party in Pune");
    expect(document.activeElement).toBe(heading);
    expect(screen.getAllByRole('tab')).toHaveLength(PLAN_TABS.length);
    expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Assistant' })).toBeInTheDocument();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves between tabs with arrows, Home and End using a roving tabindex', async () => {
    await setup();
    const overview = tab('Overview');
    overview.focus();
    await fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(tab('Budget')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Budget')).toHaveAttribute('tabindex', '0');
    expect(overview).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(tab('Budget'));
    await fireEvent.keyDown(tab('Budget'), { key: 'End' });
    expect(document.activeElement).toBe(tab('Ideas'));
    await fireEvent.keyDown(tab('Ideas'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(overview);
    await fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab('Ideas'));
    await fireEvent.keyDown(tab('Ideas'), { key: 'Home' });
    expect(document.activeElement).toBe(overview);
    await fireEvent.keyDown(overview, { key: 'a' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
  });

  it('focuses the panel heading when a tab is clicked, keeping other panels hidden', async () => {
    const { container } = await setup();
    await fireEvent.click(tab('Timeline'));
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Timeline' }),
      );
    });
    expect(container.querySelector('#panel-timeline')).not.toHaveAttribute('hidden');
    expect(container.querySelector('#panel-overview')).toHaveAttribute('hidden');
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(PLAN_TABS.length);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('records progress, vendor status and ideas in the store', async () => {
    const { store } = await setup();
    await fireEvent.click(tab('Timeline'));
    const open = store.plan?.tasks.find((task) => task.status !== 'done');
    if (open === undefined) throw new Error('fixture changed');
    await fireEvent.click(screen.getByRole('checkbox', { name: open.title }));
    expect(store.current?.checks).toContain(open.id);

    await fireEvent.click(tab('Vendors'));
    const [select] = screen.getAllByLabelText('Progress');
    if (select === undefined) throw new Error('no vendor cards');
    await fireEvent.change(select, { target: { value: 'paid' } });
    expect(Object.values(store.current?.vendors ?? {})).toContain('paid');

    await fireEvent.click(tab('Ideas'));
    await fireEvent.click(screen.getByRole('button', { name: 'Generate ideas' }));
    await waitFor(() => {
      expect(store.current?.ideas?.source).toBe('gemini');
    });
  });

  it('keeps ticked tasks off the overview list and hides their late badge', async () => {
    const { store, rerender } = await setup();
    const [first] = store.plan?.topActions ?? [];
    if (first === undefined) throw new Error('fixture has no top actions');
    await fireEvent.click(tab('Timeline'));
    await fireEvent.click(screen.getByRole('checkbox', { name: first.title }));
    // App passes the store's current entry; here the test hands it over after the change.
    if (store.current !== null) await rerender({ entry: store.current });
    const task = screen.getByRole('checkbox', { name: first.title }).closest('li');
    expect(task?.querySelector('.badge')).toBeNull();
    await fireEvent.click(tab('Overview'));
    const actions = screen.getByRole('heading', { name: 'Do these first' }).parentElement;
    expect(actions?.textContent).not.toContain(first.title);
  });

  it('applies an assistant change to the store only after confirmation', async () => {
    const { store } = await setup(
      fakeGenAi(() => ({ reply: 'Proposed change: guests 40 → 30.', patch: { invited: 30 } })),
    );
    await fireEvent.input(screen.getByLabelText('Your message'), {
      target: { value: 'fewer guests' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('group', { name: 'Proposed change' });
    expect(store.current?.input.invited).toBe(40);
    await fireEvent.click(screen.getByRole('button', { name: 'Apply change' }));
    expect(store.current?.input.invited).toBe(30);
  });

  it('wires the header actions', async () => {
    const { store, print, onedit } = await setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(onedit).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole('button', { name: 'All plans' }));
    expect(store.currentId).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /Delete this plan/ }));
    expect(store.plans).toHaveLength(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(store.plans).toHaveLength(0);
  });

  it('creates its own demo client when none is injected', async () => {
    await setup(null);
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
  });

  it('has no demo note in live mode', async () => {
    await setup({ ...fakeGenAi(), mode: 'live' });
    expect(screen.queryByText(/Demo mode/)).toBeNull();
  });
});
