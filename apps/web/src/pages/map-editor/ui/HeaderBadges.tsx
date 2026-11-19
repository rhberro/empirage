/* eslint-disable oxsome/no-inline-structural-types */
import { Badge, HStack } from '@chakra-ui/react';

import type { SpecialCounts } from './types';

export interface HeaderBadgesProps {
  specialCounts: SpecialCounts;
}

export function HeaderBadges(props: HeaderBadgesProps): React.ReactElement {
  const { specialCounts } = props;

  const blockedPalette = specialCounts.blocked >= 1 ? 'green' : 'red';
  const blockedLabel = `🔴 Blocked: ${specialCounts.blocked}`;

  const enemyPalette = specialCounts.enemySpawn >= 1 ? 'green' : 'red';
  const enemyLabel = `🟣 Enemy Spawns: ${specialCounts.enemySpawn}`;

  const trainerPalette = specialCounts.trainerSpawn >= 1 ? 'green' : 'red';
  const trainerLabel = `🔵 Trainer Spawns: ${specialCounts.trainerSpawn}`;

  const creaturePalette = specialCounts.creatureSpawn >= 1 ? 'green' : 'red';
  const creatureLabel = `🟢 Creature Spawns: ${specialCounts.creatureSpawn}`;

  return (
    <HStack gap="1.5">
      <Badge colorPalette={blockedPalette} size="sm">
        {blockedLabel}
      </Badge>
      <Badge colorPalette={enemyPalette} size="sm">
        {enemyLabel}
      </Badge>
      <Badge colorPalette={trainerPalette} size="sm">
        {trainerLabel}
      </Badge>
      <Badge colorPalette={creaturePalette} size="sm">
        {creatureLabel}
      </Badge>
    </HStack>
  );
}
