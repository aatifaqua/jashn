import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage, fakeGenAi, makeStore } from './test-fixtures.ts';
import App from './App.svelte';

// The plan view's chunk cannot be fetched, as when the app is offline before it was cached.
vi.mock('./views/PlanView.svelte', () => {
  throw new Error('chunk failed to load');
});

describe('App without the plan view chunk', () => {
  it('says the plan view could not load instead of waiting forever', async () => {
    const storage = new MemoryStorage();
    render(App, { props: { storage, store: makeStore(storage), genai: fakeGenAi() } });
    await fireEvent.click(screen.getByRole('button', { name: '7th birthday' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load the plan view/);
  });
});
