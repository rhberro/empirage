import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

export function CanvasArea(): ReactElement {
  return (
    <Box bg="bg.sunken" flex="1" minH="20rem" overflow="hidden" position="relative">
      <Box
        bgImage="linear-gradient(color-mix(in srgb, var(--chakra-colors-frost-700) 9%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--chakra-colors-frost-700) 9%, transparent) 1px, transparent 1px)"
        bgSize="2rem 2rem"
        height="100%"
        width="100%"
      />
      <CanvasBlock bg="ember.900" borderColor="ember.700" left="12%" top="26%" />
      <CanvasBlock bg="verdant.900" borderColor="verdant.700" left="20%" top="42%" />
      <CanvasBlock bg="base.800" borderColor="base.700" left="30%" top="34%" />
    </Box>
  );
}

type CanvasBlockProps = {
  bg: string;
  borderColor: string;
  left: string;
  top: string;
};

function CanvasBlock(props: CanvasBlockProps): ReactElement {
  const { bg, borderColor, left, top } = props;
  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      height="1.75rem"
      left={left}
      opacity="0.55"
      position="absolute"
      top={top}
      width="1.75rem"
    />
  );
}
