import { ActionBar, Portal } from '@chakra-ui/react';
import * as React from 'react';

import type { HuntAbility, HuntCommand, HuntState } from '../../api/hunt-protocol';
import { AbilitySlot } from './AbilitySlot';
import { CaptureSlot } from './CaptureSlot';
import { HealingSlot } from './HealingSlot';
import { WaveRangeSlot } from './WaveRangeSlot';

type HuntCommandSender = (command: HuntCommand) => boolean;
type HuntAbilities = Array<HuntAbility>;

type BottomBarProps = { hunt: HuntState | null; onCommand: HuntCommandSender };

export function BottomBar(props: BottomBarProps): React.ReactElement {
  const { hunt } = props;
  const {
    activeCreatureAbilities,
    captureConfiguration,
    captureItems,
    healingConfiguration,
    healingItemCooldownEndsAt,
    healingItems,
  } = hunt ?? {
    activeCreatureAbilities: [],
  };
  const ability1 = findAbilityBySlot(activeCreatureAbilities, 1);
  const ability2 = findAbilityBySlot(activeCreatureAbilities, 2);
  const ability3 = findAbilityBySlot(activeCreatureAbilities, 3);
  const ability4 = findAbilityBySlot(activeCreatureAbilities, 4);
  const availableCaptureItems = captureItems ?? [];
  const waveRange = hunt ? hunt.waveRange : undefined;
  return (
    <ActionBar.Root closeOnEscape={false} defaultOpen closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner>
          <ActionBar.Content bg="bg.muted">
            <WaveRangeSlot waveRange={waveRange} />
            <ActionBar.Separator />
            <AbilitySlot ability={ability1} slot={1} />
            <AbilitySlot ability={ability2} slot={2} />
            <AbilitySlot ability={ability3} slot={3} />
            <AbilitySlot ability={ability4} slot={4} />
            <ActionBar.Separator />
            <HealingSlot
              healingConfiguration={healingConfiguration}
              healingItemCooldownEndsAt={healingItemCooldownEndsAt}
              healingItems={healingItems}
            />
            <ActionBar.Separator />
            <CaptureSlot configuration={captureConfiguration} items={availableCaptureItems} />
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}

function findAbilityBySlot(abilities: HuntAbilities, slot: number): HuntAbility | undefined {
  for (const ability of abilities) {
    if (ability.slot === slot) {
      return ability;
    }
  }
  return undefined;
}
