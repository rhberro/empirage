import { Box, Button, Card, HStack, Skeleton, SkeletonCircle, Text } from '@chakra-ui/react';

export function CharacterRowSkeleton(): React.ReactElement {
  return (
    <Card.Root size="sm">
      <Card.Body>
        <HStack>
          <SkeletonCircle size="12" />
          <Box flex={1}>
            <Skeleton asChild>
              <Text>Character</Text>
            </Skeleton>
            <Skeleton asChild>
              <Text textStyle="xs">Nível 0</Text>
            </Skeleton>
          </Box>
          <Button disabled type="button" variant="subtle">
            Selecionar
          </Button>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
