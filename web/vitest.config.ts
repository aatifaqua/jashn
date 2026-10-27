import { defineConfig, mergeConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';
import viteConfig from './vite.config.ts';

/** Component tests run in jsdom with axe matchers; main.ts only mounts the app and test-fixtures.ts serves the tests, so both are excluded. */
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    plugins: [svelteTesting()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.ts'],
      // axe audits of the full plan view take several seconds under coverage instrumentation.
      testTimeout: 30_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,svelte}'],
        exclude: ['src/**/*.test.ts', 'src/test-fixtures.ts', 'src/main.ts', 'src/**/*.d.ts'],
        thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  }),
);
