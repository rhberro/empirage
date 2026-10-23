import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';

export function CanvasPlaceholder(): ReactElement {
  return (
    <Box bg="bg.sunken" flex="1" position="relative">
      <Box
        bgImage="linear-gradient(color-mix(in srgb, var(--chakra-colors-frost-700) 9%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--chakra-colors-frost-700) 9%, transparent) 1px, transparent 1px)"
        bgSize="2rem 2rem"
        height="100%"
        width="100%"
      />
      <Box bottom={3} left={3} position="absolute">
        <Text color="fg.subtle" variant="meta">
          Canvas do jogo · marco de gameplay
        </Text>
      </Box>
    </Box>
  );
}
