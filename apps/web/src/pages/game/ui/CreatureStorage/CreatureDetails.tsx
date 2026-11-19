import { Badge, HStack, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';
import { CreatureStatLine } from './CreatureStatLine';
import {
  baseStatsFor,
  calculateStats,
  ivsFor,
  rarityForCreature,
  rarityLabel,
} from './storage-creature-helpers';

type CreatureDetailsProps = { creature: CollectionCreature };

export function CreatureDetails(props: CreatureDetailsProps): React.ReactElement {
  const { creature } = props;
  const capturedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
    new Date(creature.capturedAt),
  );
  const base = baseStatsFor(creature);
  const ivs = ivsFor(creature);
  const current = calculateStats(creature, base, ivs);

  const rarity = rarityForCreature(creature);
  const badgeText = rarityLabel(rarity);
  const levelExpLabel = `Nv. ${creature.level} · EXP ${creature.experience}`;
  const elementsLabel = creature.elements.join(' · ');
  const capturedLabel = `Capturada em ${capturedAt}`;

  return (
    <Stack gap="2">
      <HStack>
        <Text fontWeight="bold">{creature.species.name}</Text>
        <Badge>{badgeText}</Badge>
      </HStack>
      <Text color="fg.muted" fontSize="xs">
        {levelExpLabel}
      </Text>
      <Text fontSize="xs">{creature.species.description}</Text>
      <Text color="fg.muted" fontSize="xs">
        {elementsLabel}
      </Text>
      <CreatureStatLine label="Base" values={base} />
      <CreatureStatLine label="IV" values={ivs} />
      <CreatureStatLine label="Atual" values={current} />
      <Text color="fg.muted" fontSize="xs">
        {capturedLabel}
      </Text>
    </Stack>
  );
}
