import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyText', () => {
  it('writes to the clipboard when allowed', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('reports false when the clipboard is missing or denied', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyText('hello')).toBe(false);
    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });
    expect(await copyText('hello')).toBe(false);
  });
});
