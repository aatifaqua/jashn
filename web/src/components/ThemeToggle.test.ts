import { fireEvent, render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY } from '../lib/theme.ts';
import { MemoryStorage } from '../test-fixtures.ts';
import ThemeToggle from './ThemeToggle.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ThemeToggle', () => {
  it('toggles the dark theme, reflects it in aria-pressed and remembers it', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const storage = new MemoryStorage();
    const root = document.createElement('html');
    const { container } = render(ThemeToggle, { props: { storage, root } });
    const button = screen.getByRole('button', { name: 'Dark theme' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(root.dataset.theme).toBe('dark');
    expect(storage.getItem(THEME_KEY)).toBe('dark');
    await fireEvent.click(button);
    expect(root.dataset.theme).toBe('light');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('starts from the saved theme', () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_KEY, 'dark');
    render(ThemeToggle, { props: { storage, root: document.createElement('html') } });
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
