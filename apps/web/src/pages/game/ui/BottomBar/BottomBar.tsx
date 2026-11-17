import { ActionBar, Portal } from '@chakra-ui/react';
import * as React from 'react';

import { selectIsHunting, useGameStore } from '../../model/game-store';
import { AbilitySlot } from './AbilitySlot';
import { CaptureSlot } from './CaptureSlot';
import { HealingSlot } from './HealingSlot';
import { WaveRangeSlot } from './WaveRangeSlot';

export function BottomBar(): React.ReactElement {
  const isHunting = useGameStore(selectIsHunting);
  const waveRangeSlot = isHunting ? <WaveRangeSlot /> : null;
  const waveRangeSeparator = isHunting ? <ActionBar.Separator /> : null;
  return (
    <ActionBar.Root closeOnEscape={false} defaultOpen closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner>
          <ActionBar.Content bg="bg.muted">
            {waveRangeSlot}
            {waveRangeSeparator}
            <AbilitySlot slot={1} />
            <AbilitySlot slot={2} />
            <AbilitySlot slot={3} />
            <AbilitySlot slot={4} />
            <ActionBar.Separator />
            <HealingSlot />
            <ActionBar.Separator />
            <CaptureSlot />
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}
