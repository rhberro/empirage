import { Center } from '@chakra-ui/react';

import { CreateCharacterForm } from '~/features/create-character';

const pagePadding = { base: '6', md: '12' };

export function CreateCharacterPage(): React.ReactElement {
  return (
    <Center bg="bg.canvas" minH="100dvh" p={pagePadding}>
      <CreateCharacterForm />
    </Center>
  );
}
