import { encodeShare } from '@jashn/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from './lib/storage.ts';
import { MemoryStorage, fakeGenAi, makeStore, sampleInput } from './test-fixtures.ts';
import App from './App.svelte';

function setup(storage = new MemoryStorage()) {
  const store = makeStore(storage);
  const genai = fakeGenAi(() => ({ reply: 'Fewer guests.', patch: { invited: 30 } }));
  const view = render(App, { props: { storage, store, genai } });
  return { ...view, store, storage };
}

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the shell: skip link, header, one h1, footer notes', async () => {
    const { container } = setup();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('banner')).toHaveTextContent('Jashn');
    expect(screen.getByRole('button', { name: 'Dark theme' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/planning estimates/);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/stay in this browser/);
    await screen.findByRole('radio', { name: 'Traditional' });
    expect(await axe(container)).toHaveNoViolations();
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

    await fireEvent.click(screen.getByRole('button', { name: 'All plans' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan your celebration' }),
    ).toBeInTheDocument();
  });

  it('opens a valid share link and clears it from the address bar', async () => {
    history.replaceState(null, '', `/#plan=${encodeShare(sampleInput('diwali-mela'))}`);
    const { store } = setup();
    await screen.findByRole('heading', { level: 1, name: /community festival in Indore/i });
    expect(store.plans).toHaveLength(1);
    expect(location.hash).toBe('');
  });

  it('reports a broken share link without opening anything', async () => {
    history.replaceState(null, '', '/#plan=broken!');
    const { store } = setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(/share link could not be opened/);
    expect(store.plans).toHaveLength(0);
    expect(location.hash).toBe('');
  });

  it('ignores in-page anchors such as the skip link', async () => {
    const { store } = setup();
    await fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await screen.findByRole('radio', { name: 'Traditional' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(store.plans).toHaveLength(0);
  });

  it('reads a share link pasted into the same tab', async () => {
    setup();
    history.replaceState(null, '', `/#plan=${encodeShare(sampleInput('kids-birthday'))}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await screen.findByRole('heading', { level: 1, name: /birthday party in Pune/ });
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

  it('warns when the browser will not keep plans', async () => {
    const store = makeStore(null);
    render(App, { props: { storage: null, store, genai: fakeGenAi() } });
    expect(await screen.findByText(/not saving plans/)).toBeInTheDocument();
  });
});
