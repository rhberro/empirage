import { Icon } from '~/shared/ui/Icon';

import type { HuntWaveRange } from '../../api/hunt-protocol';
import { toggleWaveRangeModal } from '../../model/modal-store';
import { Slot } from './Slot';

type WaveRangeSlotProps = { waveRange: HuntWaveRange | undefined };

export function WaveRangeSlot(props: WaveRangeSlotProps): React.ReactElement {
  const { waveRange } = props;
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
