import { Icon } from '~/shared/ui/Icon';

import { selectHuntWaveRange, useGameStore } from '../../model/game-store';
import { toggleWaveRangeModal } from '../../model/modal-store';
import { Slot } from './Slot';

export function WaveRangeSlot(): React.ReactElement {
  const waveRange = useGameStore(selectHuntWaveRange);
  const label = waveRange
    ? `Criaturas por onda: ${waveRange.minimumSize}–${waveRange.maximumSize}`
    : 'Criaturas por onda';
  return (
    <Slot
      content={<Icon name="groups" textStyle="2xl" />}
      cooldownEndsAt={undefined}
      cooldownMs={undefined}
      label={label}
      onClick={toggleWaveRangeModal}
    />
  );
}
