import { Box } from '@chakra-ui/react';
import type { SystemStyleObject } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { useSelectionRing } from '~/shared/theme';
import { Cooldown } from '~/shared/ui/frame';
import { Pressable } from '~/shared/ui/interactive';
import { Text } from '~/shared/ui/text';
import { readCreatureIdentity } from '~/widgets/game-hud/model/creatureIdentity';
import type { Creature } from '~/widgets/game-hud/model/gameHud.types';

import { CreaturePortrait } from './CreaturePortrait';

const TAB_WIDTH = '5.75rem';
const UNKNOWN_NAME = '—';

type CreatureTabProps = {
  /** The time left of the cooldown of the manual swap. */
  cooldownRemainingMs?: number;
  /** The whole time of the cooldown of the manual swap. */
  cooldownTotalMs?: number;
  creature: Creature;
  isActive: boolean;
  onSelect: (id: string) => void;
};

export function CreatureTab(props: CreatureTabProps): ReactElement {
  const { cooldownRemainingMs = 0, cooldownTotalMs = 0, creature, isActive, onSelect } = props;
  const selectionRing = useSelectionRing();
  const ring = isActive ? selectionRing : undefined;
  const borderColor = isActive ? 'transparent' : 'border';
  const nameColor = isActive ? 'fg' : 'fg.muted';
  const portraitColor = isActive ? 'arcane.fg' : 'fg.subtle';
  // The mask of the cooldown belongs to the tabs that are not the active one:
  // the creature that is in the field is the one the swap already reached.
  const cooldown = isActive ? 0 : cooldownRemainingMs;

  function handleSelect(): void {
    onSelect(creature.id);
  }
  return (
    <Pressable onPress={handleSelect}>
      <CreatureTabBody
        borderColor={borderColor}
        cooldownRemainingMs={cooldown}
        cooldownTotalMs={cooldownTotalMs}
        creature={creature}
        nameColor={nameColor}
        portraitColor={portraitColor}
        ring={ring}
      />
    </Pressable>
  );
}

type CreatureTabBodyProps = {
  borderColor: string;
  cooldownRemainingMs: number;
  cooldownTotalMs: number;
  creature: Creature;
  nameColor: string;
  portraitColor: string;
  ring: SystemStyleObject | undefined;
};

function CreatureTabBody(props: CreatureTabBodyProps): ReactElement {
  const {
    borderColor,
    cooldownRemainingMs,
    cooldownTotalMs,
    creature,
    nameColor,
    portraitColor,
    ring,
  } = props;
  return (
    <Box
      _before={ring}
      bg="bg.panel"
      borderColor={borderColor}
      borderRadius="sm"
      borderWidth="1px"
      boxShadow="raised"
      paddingBlock="2"
      paddingInline="1"
      position="relative"
      transitionProperty="border-color, box-shadow"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width={TAB_WIDTH}
    >
      <Box alignItems="center" display="flex" justifyContent="center">
        <CreaturePortrait
          borderColor={borderColor}
          level={creature.level}
          textColor={portraitColor}
        />
      </Box>
      <CreatureTabName creature={creature} nameColor={nameColor} />
      <CooldownMask remainingMs={cooldownRemainingMs} totalMs={cooldownTotalMs} />
    </Box>
  );
}

type CooldownMaskProps = {
  remainingMs: number;
  totalMs: number;
};

/**
 * The mask of the cooldown of the manual swap.
 *
 * The player sees the tab waiting: the shadow descends and the count tells
 * how long is left, so the swap reads as a cooldown and not as an error.
 */
function CooldownMask(props: CooldownMaskProps): ReactElement | null {
  const { remainingMs, totalMs } = props;
  if (remainingMs <= 0 || totalMs <= 0) {
    return null;
  }
  const seconds = Math.ceil(remainingMs / 1000);
  const countdown = `${seconds}s`;
  return (
    <>
      <Cooldown remaining={remainingMs} total={totalMs} />
      <Box
        alignItems="center"
        display="flex"
        inset="0"
        justifyContent="center"
        pointerEvents="none"
        position="absolute"
      >
        <Text color="fg" variant="numeric">
          {countdown}
        </Text>
      </Box>
    </>
  );
}

type CreatureTabNameProps = {
  creature: Creature;
  nameColor: string;
};

/**
 * The name of the species, under the portrait.
 *
 * The tab leads with the species: it is what the player recognizes. The element
 * and the nickname of the creature are not here: the element is on the slot of
 * the ability in the skill bar, and the nickname of a creature that was just
 * captured is the name of its trainer.
 */
function CreatureTabName(props: CreatureTabNameProps): ReactElement {
  const { creature, nameColor } = props;
  const identity = readCreatureIdentity(creature);
  const speciesName = identity.speciesName ?? UNKNOWN_NAME;
  return (
    <Text
      color={nameColor}
      marginBlockStart="1"
      overflow="hidden"
      textAlign="center"
      textOverflow="ellipsis"
      variant="name"
      whiteSpace="nowrap"
      width="full"
    >
      {speciesName}
    </Text>
  );
}
