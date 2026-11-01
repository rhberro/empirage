import { Flex, Stack } from "@chakra-ui/react";

import { SignInBrandPanel } from "./SignInBrandPanel";
import { SignInFooter } from "./SignInFooter";
import { SignInForm } from "./SignInForm";
import { SignInHeader } from "./SignInHeader";

const pagePadding = { base: "4", md: "8" };
const panelDirection = { base: "column", lg: "row" };
const panelPadding = { base: "6", md: "10" };
const formWidth = { base: "full", lg: "55%" };

export function SignInPage(): React.ReactElement {
  return (
    <Flex align="center" bg="bg.canvas" justify="center" minH="100dvh" p={pagePadding}>
      <Flex
        bg="surface.panel"
        borderColor="border.default"
        borderWidth="1px"
        boxShadow="panel"
        direction={panelDirection}
        maxW="6xl"
        overflow="hidden"
        rounded="md"
        w="full"
      >
        <SignInBrandPanel />
        <Stack gap="8" p={panelPadding} w={formWidth}>
          <SignInHeader />
          <SignInForm />
          <SignInFooter />
        </Stack>
      </Flex>
    </Flex>
  );
}
