import { defineRecipe } from '@chakra-ui/react';

const buttonRecipe = {
  base: {
    fontWeight: 'bold',
    rounded: 'lg',
    textTransform: 'uppercase',
  },
  defaultVariants: {},
} as const;

export const button = defineRecipe(buttonRecipe);
