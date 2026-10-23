import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { CornerBracket } from './CornerBracket';
import { EquippedWedge } from './EquippedWedge';
import { SLOT_SIZE } from './slot.constants';
import type { SlotProps } from './slot.types';

const SELECTED_RING_WIDTH = '2px';
const SELECTED_RING_COLOR = 'state.selected';

/**
 * The slot: the only shape that shows an item, a creature or an ability.
 *
 * It carries the four states — filled, selected (clicked), equipped and empty
 * — and nothing else. It does not know about teams, active creatures or
 * selection rings: who knows that is the domain.
 *
 * The selected state draws the border **and** the corner bracket of the top
 * left. The border is a real border, drawn by the ring that sits on top of
 * the content: the content fills the whole slot, so the art meets it at
 * every corner, and the outline of the keyboard focus lives outside the
 * element, so the two never fight.
 *
 * The content takes the whole slot: the art of a creature, the mark of an
 * item or the glyph of an ability fills the width and the height, with no
 * margin and no letterbox.
 */
export function Slot(props: SlotProps): ReactElement {
  const { children, empty = false, equipped = false, selected = false } = props;
  const content = empty ? null : children;
  const bracket = selected ? <CornerBracket /> : null;
  const wedge = equipped ? <EquippedWedge /> : null;
  const ring = buildRing(selected);
  const cursor = empty ? 'default' : 'pointer';
  return (
    <Box
      bg="bg.sunken"
      borderRadius="sm"
      boxShadow="recessed"
      cursor={cursor}
      height={SLOT_SIZE}
      position="relative"
      width={SLOT_SIZE}
    >
      <Box borderRadius="sm" height="full" overflow="hidden" width="full">
        {content}
      </Box>
      {ring}
      {bracket}
      {wedge}
    </Box>
  );
}

/**
 * The border of the selected state, as an overlay.
 *
 * The border used to live on the slot itself, and the content lost two
 * pixels to it on each side: entering with the same radius as the slot but
 * in a smaller box, the art left a dark gap at the corners, between it and
 * the border. As an overlay the ring follows the same radius on the same
 * edge, and the art keeps filling the whole slot.
 *
 * The `data-selected` marker lets outside code tell the ring apart — the
 * storage dismissal keeps the highlight when a pointerdown lands on it.
 */
function buildRing(selected: boolean): ReactElement | null {
  if (!selected) {
    return null;
  }
  return (
    <Box
      borderColor={SELECTED_RING_COLOR}
      borderRadius="sm"
      borderWidth={SELECTED_RING_WIDTH}
      data-selected="true"
      inset="0"
      pointerEvents="none"
      position="absolute"
    />
  );
}
