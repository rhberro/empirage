import { Box } from '@chakra-ui/react';
import type { CreatureVitals } from '@creatures/contracts/skill';
import type { ReactElement } from 'react';

import { IconBolt, IconHeart } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';
import type { StaminaGauge } from '~/widgets/game-hud/model/skillBar.types';

const MINUTES_PER_HOUR = 60;

type VitalsProps = {
  stamina?: StaminaGauge;
  /** The life of the active creature. */
  vitals?: CreatureVitals | null;
};

/**
 * The life of the active creature and the stamina of the trainer.
 *
 * The two bars are the two things the player plans with: how much life the
 * creature has left, and how long the trainer still hunts.
 */
export function Vitals(props: VitalsProps): ReactElement {
  const { stamina, vitals } = props;
  const staminaRatio = readStaminaRatio(stamina);
  const staminaDuration = readStaminaDuration(stamina);
  const hpRatio = readHpRatio(vitals);
  const hpValue = readHpValue(vitals);
  return (
    <Box minW="11.25rem">
      <StatusBar color="hp" duration={hpValue} icon={<IconHeart />} label="Vida" ratio={hpRatio} />
      <StatusBar
        color="stamina"
        icon={<IconBolt />}
        label="Stamina"
        ratio={staminaRatio}
        duration={staminaDuration}
      />
    </Box>
  );
}

/**
 * The life of the active creature.
 *
 * The bar fills with the life that is left, and the label says how much of it
 * is left: the number is the truth the server sent.
 */
function readHpRatio(vitals: CreatureVitals | null | undefined): number | null {
  if (vitals === undefined || vitals === null || vitals.maxHp <= 0) {
    return null;
  }
  return clampRatio(vitals.currentHp / vitals.maxHp);
}

function readHpValue(vitals: CreatureVitals | null | undefined): string | null {
  if (vitals === undefined || vitals === null) {
    return null;
  }
  return `${vitals.currentHp}/${vitals.maxHp}`;
}

function readStaminaRatio(stamina: StaminaGauge | undefined): number | null {
  if (stamina === undefined || stamina.maxMinutes <= 0) {
    return null;
  }
  return clampRatio(stamina.minutes / stamina.maxMinutes);
}

function readStaminaDuration(stamina: StaminaGauge | undefined): string | null {
  if (stamina === undefined) {
    return null;
  }
  const minutes = Math.max(stamina.minutes, 0);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return `${hours}h ${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}min`;
}

function clampRatio(ratio: number): number {
  if (ratio < 0) {
    return 0;
  }
  if (ratio > 1) {
    return 1;
  }
  return ratio;
}

type StatusBarProps = {
  color: string;
  duration?: string | null;
  icon: ReactElement;
  label: string;
  ratio: number | null;
};

function StatusBar(props: StatusBarProps): ReactElement {
  const { color, duration = null, icon, label, ratio } = props;
  const hasValue = ratio !== null;
  const widthStyle = hasValue ? `${ratio * 100}%` : '0%';
  const durationNode = renderDuration(duration);
  const fillNode = renderFill(color, hasValue, widthStyle);
  return (
    <Box marginBlockEnd="0">
      <Box alignItems="center" display="flex" gap={1} mb={1}>
        <Box color={color} display="flex">
          {icon}
        </Box>
        <Text color="fg.muted" variant="meta">
          {label}
        </Text>
        {durationNode}
      </Box>
      <Box
        bg="bg.sunken"
        borderRadius="xs"
        boxShadow="recessed"
        h="0.5rem"
        overflow="hidden"
        w="11.25rem"
      >
        {fillNode}
      </Box>
    </Box>
  );
}

/**
 * The number at the right of the label.
 *
 * The percentage of the stamina is what the bar already shows: the time is
 * what the player plans with, so it is the number that is written.
 */
function renderDuration(duration: string | null): ReactElement | null {
  if (duration === null) {
    return null;
  }
  return (
    <Text color="fg.muted" marginInlineStart="auto" variant="numeric">
      {duration}
    </Text>
  );
}

function renderFill(color: string, hasValue: boolean, widthStyle: string): ReactElement | null {
  if (!hasValue) {
    return null;
  }
  return <Box bg={color} h="full" transition="width 180ms ease-out" width={widthStyle} />;
}
