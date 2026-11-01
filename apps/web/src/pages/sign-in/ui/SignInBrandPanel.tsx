import { Box, Flex, Heading, Separator, Stack, Text } from "@chakra-ui/react";

const panelPadding = { base: "6", md: "10" };
const panelWidth = { base: "full", lg: "45%" };
const titleSize = { base: "3xl", md: "4xl" };

export function SignInBrandPanel(): React.ReactElement {
  return (
    <Stack
      bg="surface.sunken"
      gap="8"
      justify="space-between"
      p={panelPadding}
      position="relative"
      w={panelWidth}
    >
      <Box>
        <Text
          color="brand.solid"
          fontFamily="ui"
          fontSize="xs"
          fontWeight="bold"
          letterSpacing="widest"
          textTransform="uppercase"
        >
          Welcome back, adventurer
        </Text>
        <Heading color="fg.default" fontSize={titleSize} lineHeight="1.1" mt="3">
          Enter the realm.
        </Heading>
        <Text color="fg.muted" fontSize="md" lineHeight="1.7" mt="4" maxW="sm">
          Continue your journey, manage your creatures and build your empire.
        </Text>
      </Box>
      <Stack gap="4">
        <Separator borderColor="border.default" />
        <Flex align="center" gap="3">
          <Box bg="brand.solid" h="2" rounded="sm" w="2" />
          <Text color="fg.subtle" fontFamily="ui" fontSize="sm" letterSpacing="wide">
            EMPIRE ACCESS // 001
          </Text>
        </Flex>
      </Stack>
    </Stack>
  );
}
