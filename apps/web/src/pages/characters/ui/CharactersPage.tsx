import { Center, Stack } from '@chakra-ui/react';

import { CharacterList } from '~/features/character-list';
import { GameTitle } from '~/shared/ui/GameTitle';

export function CharactersPage(): React.ReactElement {
  return (
    <Center minH="dvh">
      <Stack gap="10" w="full" maxW="md">
        <GameTitle />
        <CharacterList />
      </Stack>
    </Center>
  );
}
