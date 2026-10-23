import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

const BRACKET_SIZE = '0.875rem';

/**
 * The mark of a slot that was clicked.
 *
 * It sits at the **top left** corner of the slot: the triangle fills the
 * corner, inside the border of the selected state. It is not the selection
 * ring — the ring marks a selection of a card, this marks the selected slot,
 * together with its border. The equipped wedge, at the bottom right, is a
 * different mark for a different state.
 */
export function CornerBracket(): ReactElement {
  return (
    <Box
      bg="state.selected"
      clipPath="polygon(0 0, 100% 0, 0 100%)"
      height={BRACKET_SIZE}
      left="0"
      position="absolute"
      top="0"
      width={BRACKET_SIZE}
    />
  );
}
