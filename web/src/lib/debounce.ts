/** A debounced call: `run` restarts the wait, `flush` runs a pending call now, `cancel` drops it. */
export interface Debounced<A extends unknown[]> {
  run(...args: A): void;
  flush(): void;
  cancel(): void;
}

/** Delays `fn` until calls stop for `ms`, so a burst of changes does the work once. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | null = null;
  const cancel = (): void => {
    clearTimeout(timer);
    pending = null;
  };
  const flush = (): void => {
    const args = pending;
    cancel();
    if (args !== null) fn(...args);
  };
  return {
    run(...args) {
      clearTimeout(timer);
      pending = args;
      timer = setTimeout(flush, ms);
    },
    flush,
    cancel,
  };
}
