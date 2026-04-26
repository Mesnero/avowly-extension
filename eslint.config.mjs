import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '.output/**',
      '.wxt/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'test/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Tests routinely spy on console methods to assert log shape.
      'no-console': 'off',
    },
  },
  {
    // Plain config files at the repo root are not part of the tsconfig
    // project, so the type-checked rules can't run on them. Disable the
    // project service for these files and turn off the rules that need
    // type info.
    files: ['eslint.config.mjs', 'playwright.config.ts', '*.cjs', '*.js'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: null,
      },
    },
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
