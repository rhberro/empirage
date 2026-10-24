import { Box } from '@chakra-ui/react';
import type { SystemStyleObject } from '@chakra-ui/react';
import type { HuntTeamMemberActor } from '@creatures/contracts/huntSim';
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
  creature?: Creature;
  /** The live state of the creature during a hunt: fainted, level and name. */
  huntMember?: HuntTeamMemberActor;
  isActive: boolean;
  onSelect: (id: string) => void;
};

export function CreatureTab(props: CreatureTabProps): ReactElement {
  const {
    cooldownRemainingMs = 0,
    cooldownTotalMs = 0,
    creature,
    huntMember,
    isActive,
    onSelect,
  } = props;
  const selectionRing = useSelectionRing();
  const ring = isActive ? selectionRing : undefined;
  const borderColor = isActive ? 'transparent' : 'border';
  const nameColor = isActive ? 'fg' : 'fg.muted';
  const portraitColor = isActive ? 'arcane.fg' : 'fg.subtle';
  const id = huntMember?.id ?? creature?.id ?? '';
  const fainted = huntMember?.fainted ?? false;
  const level = huntMember?.level ?? creature?.level ?? 1;
  const speciesName = huntMember?.speciesName ?? readName(creature);
  // The mask of the cooldown belongs to the tabs that are not the active one:
  // the creature that is in the field is the one the swap already reached.
  const cooldown = isActive ? 0 : cooldownRemainingMs;

  function handleSelect(): void {
    if (fainted || id === '') {
      return;
    }
    onSelect(id);
  }
  return (
    <Pressable disabled={fainted} onPress={handleSelect}>
      <CreatureTabBody
        borderColor={borderColor}
        cooldownRemainingMs={cooldown}
        cooldownTotalMs={cooldownTotalMs}
        fainted={fainted}
        level={level}
        nameColor={nameColor}
        portraitColor={portraitColor}
        ring={ring}
        speciesName={speciesName}
      />
    </Pressable>
  );
}

type CreatureTabBodyProps = {
  borderColor: string;
  cooldownRemainingMs: number;
  cooldownTotalMs: number;
  fainted: boolean;
  level: number;
  nameColor: string;
  portraitColor: string;
  ring: SystemStyleObject | undefined;
  speciesName: string;
};

function CreatureTabBody(props: CreatureTabBodyProps): ReactElement {
  const {
    borderColor,
    cooldownRemainingMs,
    cooldownTotalMs,
    fainted,
    level,
    nameColor,
    portraitColor,
    ring,
    speciesName,
  } = props;
  const background = fainted ? 'danger.subtle' : 'bg.panel';
  const opacity = fainted ? 0.5 : 1;
  return (
    <Box
      _before={ring}
      bg={background}
      borderColor={borderColor}
      borderRadius="sm"
      borderWidth="1px"
      boxShadow="raised"
      opacity={opacity}
      paddingBlock="2"
      paddingInline="1"
      position="relative"
      transitionProperty="border-color, box-shadow"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width={TAB_WIDTH}
    >
      <Box alignItems="center" display="flex" justifyContent="center">
        <CreaturePortrait borderColor={borderColor} level={level} textColor={portraitColor} />
      </Box>
      <CreatureTabName nameColor={nameColor} speciesName={speciesName} />
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
  nameColor: string;
  speciesName: string;
};

/**
 * The name of the species, under the portrait.
 */
function CreatureTabName(props: CreatureTabNameProps): ReactElement {
  const { nameColor, speciesName } = props;
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

function readName(creature: Creature | undefined): string {
  if (creature === undefined) {
    return UNKNOWN_NAME;
  }
  return readCreatureIdentity(creature).speciesName ?? UNKNOWN_NAME;
}
