// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

/** Complexity budgets keep every module small enough to read in one sitting. */
const budgets = {
  complexity: ['error', 10],
  'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
  'max-depth': ['error', 3],
  'max-params': ['error', 4],
};

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  svelte.configs['flat/recommended'],
  svelte.configs['flat/prettier'],
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js', '*.ts'] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...budgets,
      // One import statement per module, values and types together.
      'no-duplicate-imports': 'error',
      // Generated text must only ever reach the page as escaped text nodes.
      'svelte/no-at-html-tags': 'error',
    },
  },
  { files: ['eslint.config.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // The server entry pulls every event type into the importing chunk; the web app loads one lazily.
    files: ['web/src/**/*.ts', 'web/src/**/*.svelte'],
    ignores: ['**/*.test.ts', 'web/src/test-fixtures.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: '@jashn/core/server',
          message: 'Use loadProfile so each event type stays in its own chunk.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/vitest.setup.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
