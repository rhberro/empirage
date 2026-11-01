import { oxsome } from '@rhberro/oxsome';
import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';

const config: OxlintConfig = {
  categories: {
    correctness: 'error',
    nursery: 'error',
    pedantic: 'error',
    restriction: 'error',
    // Style: "error",
    suspicious: 'error',
  },
  extends: [oxsome.recommended],
  globals: {
    document: 'readonly',
  },
  ignorePatterns: ['.opencode/', '.zed/', '*.d.ts'],
  jsPlugins: ['@rhberro/oxsome/plugin'],
  overrides: [
    {
      files: ['**/*.{ts,tsx,jsx}'],
      rules: {
        'react/jsx-filename-extension': 'off',
        'react/jsx-no-literals': 'off',
        'react/react-in-jsx-scope': 'off',
      },
    },
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
  ],
  plugins: ['eslint', 'import', 'oxc', 'react', 'react-perf', 'typescript', 'unicorn'],
  rules: {
    'eslint/curly': ['error', 'all'],
    'eslint/func-style': ['error', 'declaration'],
    'eslint/no-undefined': 'off',
    'eslint/no-use-before-define': 'off',
    'eslint/sort-keys': 'error',
    'eslint/sort-vars': 'error',
    'import/no-relative-parent-imports': 'off',
    'oxc/no-rest-spread-properties': 'off',
  },
};

export default defineConfig(config);
