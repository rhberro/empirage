import { Center } from '@chakra-ui/react';

import { SignInForm } from '~/features/sign-in';

export function SignInPage(): React.ReactElement {
  return (
    <Center h="dvh">
      <SignInForm />
    </Center>
  );
}
