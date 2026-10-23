import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';

const ATTRIBUTES = [
  { label: 'Vida', value: '120' },
  { label: 'Ataque', value: '24' },
  { label: 'Defesa', value: '11' },
  { label: 'Velocidade', value: '8' },
];

const ABILITIES = [
  { cooldown: '4s', element: 'ember.400', name: 'Brasa' },
  { cooldown: '7s', element: 'ember.400', name: 'Ígnea' },
  { cooldown: '2s', element: 'base.300', name: 'Garra' },
];

export function CreatureDetail(): ReactElement {
  const attributes = ATTRIBUTES.map(renderAttribute);
  const abilities = ABILITIES.map(renderAbility);
  return (
    <Box width="17.5rem">
      <Box
        bg="bg.panel"
        borderColor="border.emphasized"
        borderRadius="sm"
        borderWidth="1px"
        boxShadow="overlay"
        overflow="hidden"
      >
        <CreatureDetailHeader />
        <Box padding="3">
          <Text color="fg.muted" marginBlockEnd="2" variant="meta">
            Atributos
          </Text>
          <Box display="grid" gap="2" gridTemplateColumns="repeat(2, 1fr)" marginBlockEnd="4">
            {attributes}
          </Box>
          <Text color="fg.muted" marginBlockEnd="2" variant="meta">
            Habilidades
          </Text>
          <Box display="flex" flexDirection="column" gap="1">
            {abilities}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * A cabecalho da ficha: a imagem, o nome e o nivel.
 */
function CreatureDetailHeader(): ReactElement {
  return (
    <Box
      alignItems="center"
      bg="bg.sunken"
      borderBottom="1px solid"
      borderColor="border"
      display="flex"
      flexDirection="column"
      padding="4"
    >
      <Box bg="ember.500" borderRadius="full" boxShadow="inner" height="3.25rem" width="3.25rem" />
      <Text color="fg" marginBlockStart="2" variant="name">
        Cinzarra
      </Text>
      <Text color="fg.subtle" variant="numeric">
        Nível 9 · Fogo
      </Text>
    </Box>
  );
}

function renderAttribute(attribute: { label: string; value: string }): ReactElement {
  return (
    <Box key={attribute.label}>
      <Text color="fg.subtle" variant="meta">
        {attribute.label}
      </Text>
      <Text color="fg" variant="numeric">
        {attribute.value}
      </Text>
    </Box>
  );
}

function renderAbility(ability: { cooldown: string; element: string; name: string }): ReactElement {
  return (
    <Box alignItems="center" display="flex" gap="2" key={ability.name}>
      <Box bg={ability.element} borderRadius="xs" height="0.625rem" width="0.625rem" />
      <Text color="fg.muted" variant="body">
        {ability.name}
      </Text>
      <Text color="fg.subtle" marginInlineStart="auto" variant="numeric">
        {ability.cooldown}
      </Text>
    </Box>
  );
}
