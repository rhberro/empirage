import { Center, Stack } from '@chakra-ui/react';

import { SignUpForm } from '~/features/sign-up';
import { GameTitle } from '~/shared/ui/GameTitle';

export function SignUpPage(): React.ReactElement {
  return (
    <Center h="dvh">
      <Stack gap="10">
        <GameTitle />
        <SignUpForm />
      </Stack>
    </Center>
  );
}
