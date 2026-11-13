import { Badge, Box, HStack, Separator, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { HuntAvailableAbility } from '../api/hunt-protocol';
import { AbilityIcon } from './BottomBar/AbilityIcon';
type AbilityDetailsProps = { ability: HuntAvailableAbility; label: string };
export function AbilityDetails(props: AbilityDetailsProps): React.ReactElement {
  const { ability, label } = props;
  const power = ability.power === null ? '—' : String(ability.power);
  const accuracy = ability.accuracy === null ? '—' : ability.accuracy + '%';
  const cooldown = (ability.cooldownMs / 1_000).toLocaleString('pt-BR') + ' s';
  const range = ability.range === 1 ? 'Melee' : 'Ranged ' + ability.range;
  const area = ability.areaRadius > 0 ? 'Área ' + ability.areaRadius : 'Alvo único';
  const category =
    ability.category === 'physical'
      ? 'Físico'
      : ability.category === 'special'
        ? 'Especial'
        : 'Status';
  const description =
    ability.areaRadius > 0
      ? 'Atinge inimigos na área ao redor do alvo.'
      : 'Atinge um inimigo dentro do alcance.';
  return (
    <Stack align="stretch" gap="2" w="full">
      <HStack gap="3">
        <Box bg="bg.muted" boxSize="12" flex="none">
          <AbilityIcon element={ability.element} name={ability.name} />
        </Box>
        <Stack gap="0">
          <Text fontWeight="bold">{ability.name}</Text>
          <HStack flexWrap="wrap">
            <Badge>{ability.element}</Badge>
            <Badge colorPalette="purple">{category}</Badge>
            <Badge colorPalette="yellow">Nível {ability.requiredLevel}</Badge>
          </HStack>
        </Stack>
      </HStack>
      <Separator />
      <SimpleGrid columns={2} gap="1" fontSize="sm">
        <Text>Poder: {power}</Text>
        <Text>Precisão: {accuracy}</Text>
        <Text>Cooldown: {cooldown}</Text>
        <Text>Alcance: {range}</Text>
        <Text>Alvo: inimigo</Text>
        <Text>Área: {area}</Text>
      </SimpleGrid>
      <Text color="fg.muted" fontSize="sm">
        {description}
      </Text>
      <Text fontSize="xs" fontWeight="bold">
        {label}
      </Text>
    </Stack>
  );
}
