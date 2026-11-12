import { Heading, Stack, Text } from '@chakra-ui/react';

export function GameTitle(): React.ReactElement {
  return (
    <Stack align="center" gap="0">
      <Text fontWeight="bold" textStyle="2xl">
        THE KINGDOM OF
      </Text>
      <Heading size="7xl" fontWeight="black">
        CREATURES
      </Heading>
    </Stack>
  );
}
