import { Box, Float } from '@chakra-ui/react';
import type {
  EquippedAbility,
  EquippedConsumable,
  EquippedDevice,
} from '@creatures/contracts/skill';
import type { SkillSlot } from '@creatures/contracts/skill';
import { ABILITY_SLOTS, CONSUMABLE_SLOTS, DEVICE_SLOT } from '@creatures/contracts/skill';
import type { ReactElement, ReactNode } from 'react';

import { usePendingLoadout } from '~/features/skill-panel';
import { Slot } from '~/shared/ui/frame';
import { IconBolt, IconPotion, IconPrism } from '~/shared/ui/icon';
import { Pressable } from '~/shared/ui/interactive';
import { Text } from '~/shared/ui/text';

import { AbilityContent, ConsumableContent, DeviceContent } from './SkillSlotContent';
type SkillSlotsProps = {
  abilities: EquippedAbility[] | undefined;
  consumables: EquippedConsumable[] | undefined;
  device: EquippedDevice | null | undefined;
  onSlotPress: ((slot: SkillSlot) => void) | undefined;
  openSlot: SkillSlot | null;
};

/**
 * The seven slots of the bar: four of abilities, two of consumables and one of
 * capture device.
 */
export function SkillSlots(props: SkillSlotsProps): ReactElement {
  const { abilities, consumables, device, onSlotPress, openSlot } = props;
  const pending = usePendingLoadout();
  const equippedAbilities = pending === null ? abilities : pending.abilities;
  const equippedConsumables = pending === null ? consumables : pending.consumables;
  const equippedDevice = pending === null ? (device ?? null) : pending.device;
  const abilitySlots = ABILITY_SLOTS.map(
    buildAbilitySlot(equippedAbilities, onSlotPress, openSlot),
  );
  const consumableSlots = CONSUMABLE_SLOTS.map(
    buildConsumableSlot(equippedConsumables, onSlotPress, openSlot),
  );
  const deviceSlot = buildDeviceSlot(equippedDevice, onSlotPress, openSlot);
  return (
    <Box display="flex" gap={1}>
      {abilitySlots}
      <Box bg="border" height="3.5rem" marginInline="1.5rem" width="1px" />
      {consumableSlots}
      <Box bg="border" height="3.5rem" marginInline="1.5rem" width="1px" />
      {deviceSlot}
    </Box>
  );
}

function buildAbilitySlot(
  abilities: EquippedAbility[] | undefined,
  onSlotPress: ((slot: SkillSlot) => void) | undefined,
  openSlot: SkillSlot | null,
): (slot: SkillSlot) => ReactElement {
  return function render(slot: SkillSlot): ReactElement {
    const ability = readAbilityAt(abilities, slot);
    const content = ability === null ? null : <AbilityContent ability={ability} />;
    return (
      <SkillSlotButton
        badge={<IconBolt />}
        key={slot}
        onSlotPress={onSlotPress}
        openSlot={openSlot}
        slot={slot}
      >
        {content}
      </SkillSlotButton>
    );
  };
}

function buildConsumableSlot(
  consumables: EquippedConsumable[] | undefined,
  onSlotPress: ((slot: SkillSlot) => void) | undefined,
  openSlot: SkillSlot | null,
): (slot: SkillSlot) => ReactElement {
  return function render(slot: SkillSlot): ReactElement {
    const consumable = readConsumableAt(consumables, slot);
    const content = consumable === null ? null : <ConsumableContent consumable={consumable} />;
    return (
      <SkillSlotButton
        badge={<IconPotion />}
        key={slot}
        onSlotPress={onSlotPress}
        openSlot={openSlot}
        slot={slot}
      >
        {content}
      </SkillSlotButton>
    );
  };
}

function buildDeviceSlot(
  device: EquippedDevice | null,
  onSlotPress: ((slot: SkillSlot) => void) | undefined,
  openSlot: SkillSlot | null,
): ReactElement {
  const content = device === null ? null : <DeviceContent device={device} />;
  return (
    <SkillSlotButton
      badge={<IconPrism />}
      onSlotPress={onSlotPress}
      openSlot={openSlot}
      slot={DEVICE_SLOT}
    >
      {content}
    </SkillSlotButton>
  );
}

/**
 * The ability equipped in a slot of the active creature.
 */
function readAbilityAt(
  abilities: EquippedAbility[] | undefined,
  slot: SkillSlot,
): EquippedAbility | null {
  const found = (abilities ?? []).find(matchesAbilitySlot(slot));
  return found ?? null;
}

function readConsumableAt(
  consumables: EquippedConsumable[] | undefined,
  slot: SkillSlot,
): EquippedConsumable | null {
  const found = (consumables ?? []).find(matchesConsumableSlot(slot));
  return found ?? null;
}

function matchesAbilitySlot(slot: SkillSlot): (ability: EquippedAbility) => boolean {
  return function matches(ability: EquippedAbility): boolean {
    return ability.slot === slot;
  };
}

function matchesConsumableSlot(slot: SkillSlot): (consumable: EquippedConsumable) => boolean {
  return function matches(consumable: EquippedConsumable): boolean {
    return consumable.slot === slot;
  };
}

type SkillSlotButtonProps = {
  badge?: ReactNode;
  children: ReactNode;
  onSlotPress: ((slot: SkillSlot) => void) | undefined;
  openSlot: SkillSlot | null;
  slot: SkillSlot;
};

/**
 * A slot of the bar that opens the panel of its group.
 *
 * The slot is a real button: the player reaches it with the keyboard, and the
 * panel opens on top of the bar without pausing the game.
 */
// eslint-disable-next-line max-lines-per-function
function SkillSlotButton(props: SkillSlotButtonProps): ReactElement {
  const { badge, children, onSlotPress, openSlot, slot } = props;
  const isEmpty = children === null;
  const isSelected = openSlot === slot;

  function handlePress(): void {
    if (onSlotPress === undefined) {
      return;
    }
    onSlotPress(slot);
  }

  const content = isEmpty ? (
    <Box
      alignItems="center"
      color="fg.subtle"
      display="flex"
      height="full"
      justifyContent="center"
      width="full"
    >
      <Text variant="title">+</Text>
    </Box>
  ) : (
    children
  );
  const badgeNode =
    badge === undefined ? null : (
      <Float offsetX="0.25rem" offsetY="0.25rem" placement="top-start" pointerEvents="none">
        <Box
          alignItems="center"
          bg="bg.panel"
          borderColor="border.emphasized"
          borderRadius="full"
          borderWidth="1px"
          color="fg.muted"
          display="flex"
          height="1.25rem"
          justifyContent="center"
          width="1.25rem"
        >
          {badge}
        </Box>
      </Float>
    );
  return (
    <Pressable onPress={handlePress}>
      <Box position="relative">
        <Slot selected={isSelected}>{content}</Slot>
        {badgeNode}
      </Box>
    </Pressable>
  );
}
