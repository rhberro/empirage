import { Center, Text } from '@chakra-ui/react';
import * as React from 'react';

export function StorageEmpty(): React.ReactElement {
  return (
    <Center gridColumn="1 / -1" p="8">
      <Text color="fg.muted">Nenhuma criatura neste armazenamento</Text>
    </Center>
  );
}
