import { getProfile, indiaDay } from '@jashn/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanStore } from './lib/plans.svelte.ts';
import { STORAGE_KEY, writePlan } from './lib/storage.ts';
import { THEME_KEY } from './lib/theme.ts';
import {
  MemoryStorage,
  TODAY,
  fakeGenAi,
  makeStore,
  sampleInput,
  savedPlan,
} from './test-fixtures.ts';
import App from './App.svelte';

function setup(storage = new MemoryStorage()) {
  const store = makeStore(storage);
  const genai = fakeGenAi(() => ({ reply: 'Fewer guests.', patch: { invited: 30 } }));
  const view = render(App, { props: { storage, store, genai } });
  return { ...view, store, storage };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
});

describe('App', () => {
  it('renders the shell: skip link, header, one h1, footer notes', async () => {
    const { container } = setup();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('banner')).toHaveTextContent('Jashn');
    expect(screen.getByRole('button', { name: 'Dark theme' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/planning estimates/);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/stays in this browser/);
    await screen.findByRole('radio', { name: 'Traditional' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws the decorative logo mark', () => {
    const { container } = setup();
    expect(container.querySelector('svg.logo-mark')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.logo-tick')).not.toBeNull();
  });

  it('toggles the dark theme, reflects it in aria-pressed and remembers it', async () => {
    const { storage } = setup();
    const button = screen.getByRole('button', { name: 'Dark theme' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(storage.getItem(THEME_KEY)).toBe('dark');
    await fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('starts from the saved theme', () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_KEY, 'dark');
    setup(storage);
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('goes from a sample to the lazy plan view, applies a change, edits and returns', async () => {
    const { container, store } = setup();
    await fireEvent.click(screen.getByRole('button', { name: '7th birthday' }));
    const title = await screen.findByRole('heading', { level: 1, name: /birthday party in Pune/ });
    expect(document.activeElement).toBe(title);
    expect(screen.getByText('36 of 40 invited')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await fireEvent.click(screen.getByRole('button', { name: 'Cut guests by 20' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Apply change' }));
    await screen.findByText('27 of 30 invited');
    expect(store.current?.input.invited).toBe(30);

    await fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit your event' }),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByRole('heading', { level: 1, name: /birthday party in Pune/ });

    await fireEvent.click(screen.getByRole('button', { name: 'New plan' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, start over' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan your celebration' }),
    ).toBeInTheDocument();
    expect(store.current).toBeNull();
  });

  it('reopens the saved plan on load', async () => {
    const storage = new MemoryStorage();
    writePlan(storage, savedPlan({ checks: ['book-venue'] }));
    const { store } = setup(storage);
    await screen.findByRole('heading', { level: 1, name: /wedding in Lucknow/ });
    expect(store.current?.checks).toEqual(['book-venue']);
  });

  it('offers to try again when the saved plan cannot load', async () => {
    const storage = new MemoryStorage();
    writePlan(storage, savedPlan());
    let online = false;
    const store = new PlanStore({
      storage,
      today: TODAY,
      loadProfile: (type) =>
        online ? Promise.resolve(getProfile(type)) : Promise.reject(new Error('offline')),
    });
    render(App, { props: { storage, store, genai: fakeGenAi() } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load your plan/);
    online = true;
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 1, name: /wedding in Lucknow/ });
  });

  it('starts a new plan when the saved plan cannot load', async () => {
    const storage = new MemoryStorage();
    writePlan(storage, savedPlan());
    const store = new PlanStore({
      storage,
      today: TODAY,
      loadProfile: () => Promise.reject(new Error('offline')),
    });
    render(App, { props: { storage, store, genai: fakeGenAi() } });
    await screen.findByRole('alert');
    await fireEvent.click(screen.getByRole('button', { name: 'Start a new plan' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan your celebration' }),
    ).toBeInTheDocument();
    expect(store.current).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('follows a plan another tab saved and ignores other keys', async () => {
    const { store, storage } = setup();
    const reload = vi.spyOn(store, 'reload');
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    expect(reload).not.toHaveBeenCalled();
    writePlan(storage, savedPlan());
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    await screen.findByRole('heading', { level: 1, name: /wedding in Lucknow/ });
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('writes pending changes when the page is hidden', async () => {
    const storage = new MemoryStorage();
    const { store } = setup(storage);
    await store.create(sampleInput());
    const flush = vi.spyOn(store, 'flush');
    window.dispatchEvent(new Event('pagehide'));
    expect(flush).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });
  });

  it('builds its own store from browser storage when nothing is injected', async () => {
    localStorage.clear();
    render(App);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan your celebration' }),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: '7th birthday' }));
    await screen.findByRole('heading', { level: 1, name: /birthday party in Pune/ });
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    localStorage.clear();
  });

  it('moves to the new day when the page is shown again', () => {
    const { store } = setup();
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2031, 0, 1, 6, 0));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const before = store.today;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(store.today).toBeGreaterThan(before);
    window.dispatchEvent(new Event('pageshow'));
    expect(store.today).toBe(indiaDay(Date.UTC(2031, 0, 1, 6, 0)));
  });

  it('warns when the browser will not keep the plan', async () => {
    const store = makeStore(null);
    render(App, { props: { storage: null, store, genai: fakeGenAi() } });
    expect(await screen.findByText(/not saving your plan/)).toBeInTheDocument();
  });
});
