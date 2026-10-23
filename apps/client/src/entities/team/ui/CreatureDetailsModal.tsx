import { Box } from '@chakra-ui/react';
import type { Creature } from '@creatures/contracts/creature';
import type { Ability } from '@creatures/contracts/species';
import type { ReactElement } from 'react';

import { readMaximumPotential } from '~/entities/team/model/creatureAttributes';
import { readCreatureName } from '~/entities/team/model/teamCreature';
import { useSpecies } from '~/entities/team/model/useSpecies';
import { AbilityCard } from '~/shared/ui/ability';
import { Modal, ModalBody, ModalHeader } from '~/shared/ui/modal';
import { Text } from '~/shared/ui/text';

import { CreatureAttributes } from './CreatureAttributes';
import { CreatureGlyph } from './CreatureGlyph';

const GLYPH_SIZE = '5rem';
const ABILITIES_TITLE = 'Habilidades';

export type CreatureDetailsModalProps = {
  creature: Creature | null;
  isOpen: boolean;
  onClose: () => void;
};

export function CreatureDetailsModal(props: CreatureDetailsModalProps): ReactElement {
  const { creature, isOpen, onClose } = props;
  const species = useSpecies(creature === null ? null : creature.speciesId);
  const title = creature === null ? '' : readCreatureName(creature);
  const body =
    creature === null ? null : <CreatureDetailsBody creature={creature} species={species} />;
  return (
    <Modal isOpen={isOpen} onClose={onClose} width="24rem">
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>{body}</ModalBody>
    </Modal>
  );
}

type CreatureDetailsBodyProps = {
  creature: Creature;
  species: Awaited<ReturnType<typeof useSpecies>>;
};

function CreatureDetailsBody(props: CreatureDetailsBodyProps): ReactElement {
  const { creature, species } = props;
  const name = readCreatureName(creature);
  const levelText = `Nível ${creature.level}`;
  const potentialText = `Potencial máximo: ${readMaximumPotential(creature)}%`;
  const abilities = species?.abilities ?? [];
  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Box alignItems="center" display="flex" gap="3">
        <Box borderRadius="md" height={GLYPH_SIZE} overflow="hidden" width={GLYPH_SIZE}>
          <CreatureGlyph creature={creature} />
        </Box>
        <Box display="flex" flexDirection="column">
          <Text variant="name">{name}</Text>
          <Text color="fg.muted" variant="meta">
            {levelText}
          </Text>
          <Text color="fg.subtle" variant="meta">
            {potentialText}
          </Text>
        </Box>
      </Box>
      <CreatureAttributes creature={creature} detailed />
      <Box display="flex" flexDirection="column" gap="2">
        <Text color="fg.muted" variant="section">
          {ABILITIES_TITLE}
        </Text>
        <CreatureAbilities abilities={abilities} />
      </Box>
    </Box>
  );
}

type CreatureAbilitiesProps = {
  abilities: Ability[];
};

function CreatureAbilities(props: CreatureAbilitiesProps): ReactElement {
  const { abilities } = props;
  if (abilities.length === 0) {
    return (
      <Text color="fg.subtle" variant="meta">
        Esta espécie não tem habilidades.
      </Text>
    );
  }
  const lines = abilities.map(function renderAbility(ability): ReactElement {
    return (
      <AbilityCard
        cooldownMs={ability.cooldownMs}
        damage={ability.damage}
        description={ability.description}
        element={ability.element}
        key={ability.id}
        name={ability.name}
      />
    );
  });
  return (
    <Box display="flex" flexDirection="column" gap="2">
      {lines}
    </Box>
  );
}
