import { Avatar, AvatarGroup, Button, IconButton, Stack, Text } from '@chakra-ui/react';

import { Icon } from '~/shared/ui/Icon';

import type { Character } from '../api/get-characters';

export function CharacterRow(props: Character): React.ReactElement {
  return (
    <Stack flexDirection="row">
      <AvatarGroup shape="rounded" size="xl">
        <Avatar.Root>
          <Avatar.Fallback />
          <Avatar.Image />
        </Avatar.Root>
      </AvatarGroup>
      <Stack flex={1}>
        <Text>{props.name}</Text>
        <Text>Nível {props.level}</Text>
      </Stack>
      <IconButton type="button" variant="subtle">
        <Icon name="delete" size="md" />
      </IconButton>
      <Button type="button">Selecionar</Button>
    </Stack>
  );
}
