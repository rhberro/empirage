import { Box } from '@chakra-ui/react';
import type { Creature } from '@creatures/contracts/creature';
import type { ReactElement } from 'react';

import { readCreatureName } from '~/entities/team/model/teamCreature';
import { Text } from '~/shared/ui/text';

import { CreatureAttributes } from './CreatureAttributes';
import { CreatureGlyph } from './CreatureGlyph';

const GLYPH_SIZE = '2.25rem';

export type CreatureTooltipProps = {
  creature: Creature;
  /** The status of the creature, when the game has one to show. */
  status?: string | null;
};

/**
 * The popup of a creature.
 *
 * O popup e a ficha rapida da criatura: a imagem, o nome, o nivel e os
 * atributos que ela tem agora. O detalhe completo, com os valores de base, o
 * potencial maximo e as habilidades, vive no modal dos detalhes.
 */
export function CreatureTooltip(props: CreatureTooltipProps): ReactElement {
  const { creature, status = null } = props;
  const name = readCreatureName(creature);
  const levelText = `Nível ${creature.level}`;
  const statusNode =
    status === null ? null : (
      <Text color="fg.muted" variant="meta">
        {status}
      </Text>
    );
  return (
    <Box display="flex" flexDirection="column" gap="2" minW="13rem">
      <Box alignItems="center" display="flex" gap="2">
        <Box borderRadius="sm" height={GLYPH_SIZE} overflow="hidden" width={GLYPH_SIZE}>
          <CreatureGlyph creature={creature} />
        </Box>
        <Box display="flex" flexDirection="column">
          <Text variant="name">{name}</Text>
          <Text color="fg.muted" variant="meta">
            {levelText}
          </Text>
          {statusNode}
        </Box>
      </Box>
      <CreatureAttributes creature={creature} />
    </Box>
  );
}
