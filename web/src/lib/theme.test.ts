import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../test-fixtures.ts';
import { THEME_KEY, currentTheme, savedTheme, setTheme } from './theme.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('reads only valid saved themes', () => {
    const storage = new MemoryStorage();
    expect(savedTheme(storage)).toBeNull();
    storage.setItem(THEME_KEY, 'dark');
    expect(savedTheme(storage)).toBe('dark');
    storage.setItem(THEME_KEY, 'neon');
    expect(savedTheme(storage)).toBeNull();
    expect(savedTheme(null)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(savedTheme(broken)).toBeNull();
  });

  it('follows the system preference when nothing is saved', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(currentTheme(null)).toBe('dark');
    const storage = new MemoryStorage();
    storage.setItem(THEME_KEY, 'light');
    expect(currentTheme(storage)).toBe('light');
    vi.stubGlobal('matchMedia', undefined);
    expect(currentTheme(null)).toBe('light');
  });

  it('applies and saves a choice, tolerating blocked storage', () => {
    const root = document.createElement('html');
    const storage = new MemoryStorage();
    setTheme('dark', storage, root);
    expect(root.dataset.theme).toBe('dark');
    expect(storage.getItem(THEME_KEY)).toBe('dark');
    storage.failWrites = true;
    setTheme('light', storage, root);
    expect(root.dataset.theme).toBe('light');
  });
});
