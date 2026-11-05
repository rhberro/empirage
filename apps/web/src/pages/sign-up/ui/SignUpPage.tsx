import { Center } from '@chakra-ui/react';

import { SignUpForm } from '~/features/sign-up';

export function SignUpPage(): React.ReactElement {
  return (
    <Center h="dvh">
      <SignUpForm />
    </Center>
  );
}
