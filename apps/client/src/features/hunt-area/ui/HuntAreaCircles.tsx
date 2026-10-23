import { Box } from '@chakra-ui/react';
import type { HuntAreaSpecies } from '@creatures/contracts/hunt';
import type { ReactElement } from 'react';

import { huntAreaToneFill } from '~/features/hunt-area/model/huntAreaTone';
import { Popup } from '~/shared/ui/popup';
import { Text } from '~/shared/ui/text';

const CIRCLE_SIZE = '1.25rem';
const CIRCLE_OVERLAP = '-0.375rem';
const MAX_SLOTS = 7;
const OVERFLOW_SLOTS = 6;

type HuntAreaCirclesProps = {
  species: HuntAreaSpecies[];
};

/**
 * The creatures of the area, in a sequence of overlapping circles.
 *
 * The sequence has seven positions at most. When the area has more creatures
 * than that, the first six are drawn and the last position is the mark that
 * says there are more.
 *
 * Every circle opens the popup with the name of the species.
 */
export function HuntAreaCircles(props: HuntAreaCirclesProps): ReactElement {
  const { species } = props;
  const overflow = species.length > MAX_SLOTS;
  const visible = overflow ? species.slice(0, OVERFLOW_SLOTS) : species.slice(0, MAX_SLOTS);
  const circles = visible.map(renderCircle);
  const overflowMark = overflow ? <OverflowMark /> : null;
  return (
    <Box alignItems="center" display="flex" height={CIRCLE_SIZE}>
      {circles}
      {overflowMark}
    </Box>
  );
}

function renderCircle(entry: HuntAreaSpecies, index: number): ReactElement {
  const margin = index === 0 ? '0' : CIRCLE_OVERLAP;
  const fill = huntAreaToneFill(entry.tone);
  const name = entry.species.name;
  const mark = (
    <Box
      aria-label={name}
      bg={fill}
      borderRadius="full"
      height={CIRCLE_SIZE}
      marginInlineStart={margin}
      role="img"
      width={CIRCLE_SIZE}
    />
  );
  return (
    <Popup
      content={
        <Text color="fg" variant="name">
          {name}
        </Text>
      }
      key={entry.species.id}
    >
      {mark}
    </Popup>
  );
}

function OverflowMark(): ReactElement {
  return (
    <Box
      alignItems="center"
      bg="bg.raised"
      borderRadius="full"
      display="flex"
      height={CIRCLE_SIZE}
      justifyContent="center"
      marginInlineStart={CIRCLE_OVERLAP}
      width={CIRCLE_SIZE}
    >
      <Text color="fg.muted" variant="numeric">
        +
      </Text>
    </Box>
  );
}
