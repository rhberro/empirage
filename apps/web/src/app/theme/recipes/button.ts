import { defineRecipe } from '@chakra-ui/react';

const buttonRecipe = {
  base: {
    colorPalette: 'red',
    rounded: 'full',
  },
  defaultVariants: {},
} as const;

export const button = defineRecipe(buttonRecipe);
