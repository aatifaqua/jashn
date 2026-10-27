/** A debounced call: `run` restarts the wait, `cancel` drops a pending call. */
export interface Debounced<A extends unknown[]> {
  run(...args: A): void;
  cancel(): void;
}

/**
 * Delays `fn` until calls stop for `ms`, so typing in the form recomputes the live summary
 * once per pause instead of once per keystroke.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    run(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fn(...args);
      }, ms);
    },
    cancel() {
      clearTimeout(timer);
    },
  };
}
