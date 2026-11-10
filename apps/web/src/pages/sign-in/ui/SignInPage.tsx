import { Center, Stack } from '@chakra-ui/react';

import { SignInForm } from '~/features/sign-in';
import { GameTitle } from '~/shared/ui/GameTitle';

export function SignInPage(): React.ReactElement {
  return (
    <Center minH="dvh">
      <Stack gap="10" w="full" maxW="md">
        <GameTitle />
        <SignInForm />
      </Stack>
    </Center>
  );
}
