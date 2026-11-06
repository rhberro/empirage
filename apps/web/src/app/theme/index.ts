import { createSystem, defaultConfig, defineConfig, defineTokens } from '@chakra-ui/react';

import { button } from './recipes/button';

const tokens = {
  fonts: {
    body: {
      value: 'Barlow, sans-serif',
    },
    heading: {
      value: 'Cinzel, serif',
    },
    mono: {
      value: 'JetBrains Mono, monospace',
    },
  },
};

const themeConfig = {
  strictTokens: true,
  theme: {
    recipes: {
      button,
    },
    tokens: defineTokens(tokens),
  },
};

const config = defineConfig(themeConfig);

export const system = createSystem(defaultConfig, config);
