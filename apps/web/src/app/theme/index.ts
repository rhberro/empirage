import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineRecipe,
  defineTokens,
} from '@chakra-ui/react';

const buttonRecipe = {
  base: {},
  defaultVariants: {},
  variants: {
    size: {},
    variant: {},
  },
} as const;

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
      button: defineRecipe(buttonRecipe),
    },
    tokens: defineTokens(tokens),
  },
};

const config = defineConfig(themeConfig);

export const system = createSystem(defaultConfig, config);
