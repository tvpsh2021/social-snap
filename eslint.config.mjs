import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: ['coverage/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        PLATFORMS: 'readonly',
        PLATFORM_HOSTNAMES: 'readonly',
        CONTENT_MESSAGES: 'readonly',
        POPUP_MESSAGES: 'readonly',
        BACKGROUND_MESSAGES: 'readonly',
        getFileExtension: 'readonly',
        getPlatformFromUrl: 'readonly',
        wait: 'readonly',
        importScripts: 'readonly',
      }
    },
    rules: {
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      // Allow _ as a placeholder for intentionally unused catch parameters
      'no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_' }],
      // Allow empty catch blocks (silent error suppression in JSON traversal)
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['tests/**/*.{js,mjs,cjs}', 'jest.config.js', 'jest.setup.js'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        chrome: 'readonly',
      }
    },
    rules: {
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
    },
  },
  {
    // Content tests run in jsdom and use browser globals (document, window, performance)
    files: ['tests/content/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      }
    },
  },
  {
    files: ['scripts/**/*.js'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.node,
      }
    },
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
    },
  },
  {
    files: ['src/shared/**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
      }
    },
  },
]);
