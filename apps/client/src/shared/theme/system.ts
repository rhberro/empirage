import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

import { layerRecipe } from './recipes/layer';
import { selectionRingRecipe } from './recipes/selectionRing';
import { semanticTokens } from './semanticTokens';
import { textStyles } from './textStyles';
import { colors, fonts, radii, shadows } from './tokens';

const scrollbar = {
  '&::-webkit-scrollbar': {
    height: '8px',
    width: '8px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '{colors.base.700}',
    borderRadius: '2px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: '{colors.base.600}',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
};

const globalCss = {
  '#root': {
    boxShadow: 'inset 0 0 180px 0 rgba(0, 0, 0, 0.4)',
    minHeight: '100%',
  },
  '*': {
    WebkitTapHighlightColor: 'transparent',
  },
  '::selection': {
    background: '{colors.gold.500}',
    color: '{colors.base.950}',
  },
  '@keyframes alert-enter': {
    from: { opacity: '0', transform: 'translateX(24px)' },
    to: { opacity: '1', transform: 'translateX(0)' },
  },
  '@keyframes alert-exit': {
    from: { opacity: '1', transform: 'translateX(0)' },
    to: { opacity: '0', transform: 'translateX(24px)' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '*, *::before, *::after': {
      animationDuration: '0.01ms !important',
      animationIterationCount: '1 !important',
      scrollBehavior: 'auto !important',
      transitionDuration: '0.01ms !important',
    },
  },
  '@supports (min-height: 100dvh)': {
    'html, body': {
      minHeight: '100dvh',
    },
  },
  body: {
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    fontFamily: 'body',
    minHeight: '100vh',
    overscrollBehavior: 'none',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    paddingTop: 'env(safe-area-inset-top)',
    textRendering: 'auto',
    touchAction: 'manipulation',
    userSelect: 'none',
    ...scrollbar,
  },
  button: {
    touchAction: 'manipulation',
  },
  html: {
    touchAction: 'manipulation',
  },
  'html, body, #root': {
    background: '{colors.base.950}',
    color: '{colors.base.50}',
    colorScheme: 'dark',
  },
  'input, select, textarea, .chakra-input, .chakra-select, .chakra-textarea': {
    WebkitTextSizeAdjust: '100%',
    WebkitUserSelect: 'text',
    fontSize: '16px !important',
    textSizeAdjust: '100%',
    userSelect: 'text',
  },
};

const config = defineConfig({
  globalCss,
  theme: {
    recipes: {
      selectionRing: selectionRingRecipe,
    },
    semanticTokens,
    slotRecipes: {
      layer: layerRecipe,
    },
    textStyles,
    tokens: {
      colors,
      fonts,
      radii,
      shadows,
    },
  },
});

export const system = createSystem(defaultConfig, config);
