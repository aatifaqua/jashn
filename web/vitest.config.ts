import { defineConfig, mergeConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';
import viteConfig from './vite.config.ts';

/** Component tests run in jsdom with axe matchers; main.ts only mounts the app, so it is excluded. */
export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [svelteTesting()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,svelte}'],
        exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/**/*.d.ts'],
        thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  }),
);
