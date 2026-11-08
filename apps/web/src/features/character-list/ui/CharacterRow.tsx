import { Avatar, AvatarGroup, Box, Button, Card, HStack, Text } from '@chakra-ui/react';

import type { Character } from '../api/get-characters';

export function CharacterRow(props: Character): React.ReactElement {
  const { level, name } = props;
  return (
    <Card.Root size="sm">
      <Card.Body>
        <HStack>
          <AvatarGroup size="xl">
            <Avatar.Root>
              <Avatar.Fallback name={name} />
              <Avatar.Image />
            </Avatar.Root>
          </AvatarGroup>
          <Box flex={1}>
            <Text>{name}</Text>
            <Text color="fg.muted" textStyle="xs">
              Nível {level}
            </Text>
          </Box>
          <Button type="button" variant="subtle">
            Selecionar
          </Button>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
