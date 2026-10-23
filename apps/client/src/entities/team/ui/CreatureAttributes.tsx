import { Box, Progress } from '@chakra-ui/react';
import type { Creature } from '@creatures/contracts/creature';
import type { ReactElement } from 'react';

import {
  readCreatureAttributeRows,
  type CreatureAttributeRow,
} from '~/entities/team/model/creatureAttributes';
import { Text } from '~/shared/ui/text';

const VALUE_WIDTH = '2.5rem';

export type CreatureAttributesProps = {
  creature: Creature;
  /** Whether the base value and the potential are shown. */
  detailed?: boolean;
};

export function CreatureAttributes(props: CreatureAttributesProps): ReactElement {
  const { creature, detailed = false } = props;
  const rows = readCreatureAttributeRows(creature);
  if (!detailed) {
    const lines = rows.map(renderCompactRow);
    return (
      <Box display="flex" flexDirection="column" gap="1" maxW="22rem">
        {lines}
      </Box>
    );
  }
  const attributeRows = rows.map(renderAttributeRow);
  const potentialLines = rows.map(renderPotentialRow);
  return (
    <Box display="flex" flexDirection="column" gap="4" maxW="22rem">
      <Box display="flex" flexDirection="column" gap="1">
        <Text color="fg.muted" variant="section">
          Atributos
        </Text>
        <Box display="grid" gap="2" gridTemplateColumns="1fr auto auto">
          <Text color="fg.subtle" variant="meta">
            Atributo
          </Text>
          <Text color="fg.subtle" textAlign="center" variant="meta">
            Base
          </Text>
          <Text color="fg.subtle" textAlign="center" variant="meta">
            Atual
          </Text>
          {attributeRows}
        </Box>
      </Box>
      <Box display="flex" flexDirection="column" gap="1">
        <Text color="fg.muted" variant="section">
          PVs
        </Text>
        {potentialLines}
      </Box>
    </Box>
  );
}

function renderAttributeRow(row: CreatureAttributeRow): ReactElement {
  return (
    <>
      <Text color="fg.muted" variant="meta">
        {row.label}
      </Text>
      <Text color="fg.subtle" opacity="0.6" textAlign="center" variant="numeric">
        {row.base}
      </Text>
      <Text color="fg" textAlign="center" variant="numeric">
        {row.current}
      </Text>
    </>
  );
}

function renderCompactRow(row: CreatureAttributeRow): ReactElement {
  return (
    <Box alignItems="center" display="flex" gap="2" justifyContent="space-between" key={row.label}>
      <Text color="fg.muted" variant="meta">
        {row.label}
      </Text>
      <Text color="fg" textAlign="end" variant="numeric" width={VALUE_WIDTH}>
        {row.current}
      </Text>
    </Box>
  );
}

function readPotentialColor(percent: number): string {
  if (percent <= 19) {
    return 'blood.400';
  }
  if (percent <= 49) {
    return 'arcane.400';
  }
  if (percent <= 69) {
    return 'gold.400';
  }
  if (percent <= 89) {
    return 'verdant.400';
  }
  return 'gold.500';
}

function renderPotentialRow(row: CreatureAttributeRow): ReactElement {
  const color = readPotentialColor(row.potential);
  return (
    <Box alignItems="center" display="flex" gap="2" key={row.label}>
      <Text color="fg.muted" minW="6rem" variant="meta">
        {row.label}
      </Text>
      <Progress.Root flex="1" max={100} min={0} value={row.potential}>
        <Progress.Track bg="bg.sunken" borderRadius="xs" h="0.5rem">
          <Progress.Range bg={color} />
        </Progress.Track>
      </Progress.Root>
      <Text color="fg" textAlign="end" variant="numeric" width={VALUE_WIDTH}>
        {row.potential}%
      </Text>
    </Box>
  );
}
