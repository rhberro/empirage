import { Box, Button, Container, Flex, Heading, Stack } from "@chakra-ui/react";

export function DesignSystemPage(): React.ReactElement {
  return (
    <Container>
      <Flex>
        <Stack>
          <Heading>Menu</Heading>
          <Button>Example 1</Button>
          <Button>Example 2</Button>
          <Button>Example 3</Button>
          <Button>Example 4</Button>
        </Stack>
        <Flex flex="1">
          <Box padding="4">Sidebar</Box>
        </Flex>
      </Flex>
    </Container>
  );
}
