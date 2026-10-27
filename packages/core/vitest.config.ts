import { defineConfig } from 'vitest/config';

/** The core is pure logic with no I/O, so full coverage is both achievable and enforced. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/types.ts',
        'src/*-types.ts',
        'src/test-fixtures.ts',
        'src/**/*.fixture.ts',
      ],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
