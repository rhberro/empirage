import { createSystem, defaultConfig, defineConfig, defineTokens } from '@chakra-ui/react';

import { button } from './recipes/button';
import { card } from './recipes/card';

const tokens = {
  fonts: {
    body: {
      value: 'Outfit Variable, sans-serif',
    },
    heading: {
      value: 'Lexend Deca Variable, sans-serif',
    },
    mono: {
      value: 'JetBrains Mono Variable, monospace',
    },
  },
};

const themeConfig = {
  globalCss: {
    html: {
      bg: 'bg.muted',
    },
  },
  strictTokens: true,
  theme: {
    recipes: { button },
    semanticTokens: {
      shadows: {
        panel: {
          value: '0 1px 2px rgba(0, 0, 0, 0.06), 0 6px 16px rgba(0, 0, 0, 0.06)',
        },
      },
    },
    slotRecipes: { card },
    tokens: defineTokens(tokens),
  },
} as const;

const config = defineConfig(themeConfig);

export const system = createSystem(defaultConfig, config);
