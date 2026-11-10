import { Center, Stack } from '@chakra-ui/react';

import { SignUpForm } from '~/features/sign-up';
import { GameTitle } from '~/shared/ui/GameTitle';

export function SignUpPage(): React.ReactElement {
  return (
    <Center minH="dvh">
      <Stack gap="10" w="full" maxW="md">
        <GameTitle />
        <SignUpForm />
      </Stack>
    </Center>
  );
}
