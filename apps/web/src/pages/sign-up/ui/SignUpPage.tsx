import { Center } from "@chakra-ui/react";

import { SignUpForm } from "~/features/sign-up";

const pagePadding = { base: "6", md: "12" };

export function SignUpPage(): React.ReactElement {
  return (
    <Center bg="bg.canvas" minH="100dvh" p={pagePadding}>
      <SignUpForm />
    </Center>
  );
}
