import { defineRecipe } from '@chakra-ui/react';

const buttonRecipe = {
  base: {
    rounded: 'full',
  },
  defaultVariants: {},
} as const;

export const button = defineRecipe(buttonRecipe);
