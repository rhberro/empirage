import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

const WEDGE_SIZE = '0.75rem';

/**
 * The mark of an equipped item.
 *
 * It sits at the **bottom right** corner of the slot: the triangle fills the
 * corner, so the player reads "this is equipped" without a label. The focus
 * bracket, at the top left, is a different mark for a different state.
 */
export function EquippedWedge(): ReactElement {
  return (
    <Box
      bg="state.equipped"
      bottom="0"
      clipPath="polygon(100% 0, 100% 100%, 0 100%)"
      height={WEDGE_SIZE}
      position="absolute"
      right="0"
      width={WEDGE_SIZE}
    />
  );
}
