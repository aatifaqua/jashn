import { defineConfig } from 'vitest/config';

/**
 * Server tests run offline with Gemini faked. index.ts only wires real I/O and testing.ts is
 * test support, so both are left out of coverage.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/testing.ts'],
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
