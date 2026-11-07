import { defineSlotRecipe } from '@chakra-ui/react';

const cardRecipe = {
  slots: ['root'],
  variants: {
    variant: {
      elevated: {
        root: {
          // boxShadow: 'panel',
        },
      },
    },
  },
} as const;

export const card = defineSlotRecipe(cardRecipe);
