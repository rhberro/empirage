import { Center } from '@chakra-ui/react';

import { CreateCharacterForm } from '~/features/create-character';

export function CreateCharacterPage(): React.ReactElement {
  return (
    <Center h="dvh">
      <CreateCharacterForm />
    </Center>
  );
}
