import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import type { AxeMatchers } from 'vitest-axe';

declare module 'vitest' {
  /** Adds `toHaveNoViolations` to every assertion; the parameters mirror Vitest's own. */
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends AxeMatchers {
    /** Names the parameters so the augmentation stays identical to the original interface. */
    readonly _subject?: [R, T];
  }
}

expect.extend(axeMatchers);

// jsdom has no canvas; axe probes one for its colour-contrast rule, which jsdom cannot compute
// anyway (contrast is documented on every token in app.css). Returning null keeps logs quiet.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;
