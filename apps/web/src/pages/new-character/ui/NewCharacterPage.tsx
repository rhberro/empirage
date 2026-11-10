import { Center, Stack } from '@chakra-ui/react';

import { CreateCharacterForm } from '~/features/create-character';
import { GameTitle } from '~/shared/ui/GameTitle';

export function NewCharacterPage(): React.ReactElement {
  return (
    <Center minH="dvh">
      <Stack gap="10" w="full" maxW="md">
        <GameTitle />
        <CreateCharacterForm />
      </Stack>
    </Center>
  );
}
