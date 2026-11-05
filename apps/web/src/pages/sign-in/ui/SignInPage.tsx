import { Center } from '@chakra-ui/react';

import { SignInForm } from '~/features/sign-in';

const pagePadding = { base: '6', md: '12' };

export function SignInPage(): React.ReactElement {
  return (
    <Center bg="bg.canvas" minH="100dvh" p={pagePadding}>
      <SignInForm />
    </Center>
  );
}
