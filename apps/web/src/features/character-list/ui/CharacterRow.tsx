import { Avatar, AvatarGroup, Box, Button, Card, HStack, Text } from '@chakra-ui/react';

import type { Character } from '~/entities/character';

import { useSelectCharacter } from '../model/use-select-character';

export function CharacterRow(props: Character): React.ReactElement {
  const { id, level, name } = props;
  const selectCharacterMutation = useSelectCharacter();
  function handleSelect(): void {
    selectCharacterMutation.mutate(id);
  }
  return (
    <Card.Root size="sm" variant="subtle">
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
          <Button
            disabled={selectCharacterMutation.isPending}
            loading={selectCharacterMutation.isPending}
            onClick={handleSelect}
            type="button"
          >
            Selecionar
          </Button>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
