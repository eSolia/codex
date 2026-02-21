import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import oxlint from 'eslint-plugin-oxlint';
import { noRawHtml } from './eslint-rules/no-raw-html.js';
import { noBindingLeak } from './eslint-rules/no-binding-leak.js';
import { noSchemaParse } from './eslint-rules/no-schema-parse.js';
import { noSilentCatch } from './eslint-rules/no-silent-catch.js';
import { noRawDbPrepare } from './eslint-rules/no-raw-db-prepare.js';

// Custom backpressure rules plugin
const esoliaPlugin = {
  meta: { name: 'eslint-plugin-esolia', version: '1.0.0' },
  rules: {
    'no-raw-html': noRawHtml,
    'no-binding-leak': noBindingLeak,
    'no-schema-parse': noSchemaParse,
    'no-silent-catch': noSilentCatch,
    'no-raw-db-prepare': noRawDbPrepare,
  },
};

export default ts.config(
  // Base configs
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],

  // Global settings
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      esolia: esoliaPlugin,
    },
    rules: {
      // Unused vars: let eslint handle this (not oxlint) for Svelte awareness
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // Backpressure rules
      'esolia/no-raw-html': 'error',
      'esolia/no-binding-leak': 'error',
      'esolia/no-schema-parse': 'warn',
      'esolia/no-silent-catch': 'error',
    },
  },

  // Svelte file handling
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },

  // Server-only files: stricter rules
  {
    files: ['**/*.server.ts', '**/server/**/*.ts', '**/hooks.*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage'],
    },
  },

  // Route files: warn on raw db.prepare() — guides toward site-context helpers
  {
    files: ['src/routes/**/*.ts', 'src/routes/**/*.svelte'],
    rules: {
      'esolia/no-raw-db-prepare': 'warn',
    },
  },

  // Test files: relax some rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'esolia/no-silent-catch': 'off',
    },
  },

  // Ignores
  {
    ignores: ['build/', '.svelte-kit/', 'dist/', 'node_modules/', '.wrangler/'],
  },

  // Oxlint compat: MUST be last — disables rules oxlint already covers
  oxlint.configs['flat/recommended']
);
