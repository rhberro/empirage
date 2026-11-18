import { Text } from '@chakra-ui/react';

import { selectHuntWaveRangeMaximumSize, useGameStore } from '../../model/game-store';
import { toggleWaveRangeModal } from '../../model/modal-store';
import { Slot } from './Slot';

export function WaveRangeSlot(): React.ReactElement {
  const maximumSize = useGameStore(selectHuntWaveRangeMaximumSize);
  return (
    <Slot
      content={<Text textStyle="xl">{maximumSize}</Text>}
      cooldownEndsAt={undefined}
      cooldownMs={undefined}
      label="Criaturas"
      onClick={toggleWaveRangeModal}
    />
  );
}
