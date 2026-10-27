import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('runs once with the last arguments after calls stop', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 150);
    debounced.run(1);
    debounced.run(2);
    vi.advanceTimersByTime(149);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('drops a pending call on cancel', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 10);
    debounced.run();
    debounced.cancel();
    vi.runAllTimers();
    expect(fn).not.toHaveBeenCalled();
  });
});
