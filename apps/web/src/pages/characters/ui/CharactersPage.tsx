import { Center } from '@chakra-ui/react';

import { CharacterList } from '~/features/character-list';

export function CharactersPage(): React.ReactElement {
  return (
    <Center h="dvh">
      <CharacterList />
    </Center>
  );
}
