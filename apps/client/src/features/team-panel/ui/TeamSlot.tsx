import { Flex } from '@chakra-ui/react';

import { useCreatureAt } from '~/features/team-panel/model/useCreatureAt';

import { TeamSlotImage } from './TeamSlotImage';
import { TeamSlotName } from './TeamSlotName';
import { TeamSlotOverlay } from './TeamSlotOverlay';

type TeamSlotProperties = { position: number };

export function TeamSlot(props: TeamSlotProperties): React.ReactElement {
  const { position } = props;
  const creature = useCreatureAt(position);
  const content = creature ? (
    <>
      <TeamSlotImage>
        <TeamSlotOverlay>{creature.level}</TeamSlotOverlay>
      </TeamSlotImage>
      <TeamSlotName>{creature.speciesName}</TeamSlotName>
    </>
  ) : null;
  return (
    <Flex
      bg="bg.raised"
      className="slot"
      flexDirection="column"
      gap="2"
      p="2"
      px="1"
      transition="transform 200ms ease-out"
      width="20"
    >
      {content}
    </Flex>
  );
}
