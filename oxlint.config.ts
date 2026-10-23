import { oxsome } from '@rhberro/oxsome';
import { type OxlintConfig, defineConfig } from 'oxlint';

const config: OxlintConfig = {
  categories: {
    correctness: 'error',
    nursery: 'error',
    pedantic: 'error',
    restriction: 'error',
    // style: "error",
    suspicious: 'error',
  },
  extends: [oxsome.recommended],
  globals: {
    DOMRect: 'readonly',
    Node: 'readonly',
    ResizeObserver: 'readonly',
    clearInterval: 'readonly',
    clearTimeout: 'readonly',
    document: 'readonly',
    getComputedStyle: 'readonly',
    process: 'readonly',
    setInterval: 'readonly',
    setTimeout: 'readonly',
    window: 'readonly',
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
    'eslint/no-void': 'off',
    'eslint/sort-keys': 'error',
    'eslint/sort-vars': 'error',
    'import/max-dependencies': 'off',
    'oxc/no-optional-chaining': 'off',
    'oxc/no-rest-spread-properties': 'off',
    'oxsome/no-inline-functions-objects-arrays': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react/no-clone-element': 'off',
    'react/no-multi-comp': 'off',
    'react/refs': 'off',
    'react/use-memo': 'off',
    'unicorn/no-array-callback-reference': 'off',
  },
};

export default defineConfig(config);
