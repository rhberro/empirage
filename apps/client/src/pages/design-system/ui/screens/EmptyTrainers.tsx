import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Frame, FrameHeader } from '~/shared/ui/frame';
import { Text } from '~/shared/ui/text';

export function EmptyTrainers(): ReactElement {
  return (
    <Box width="23.75rem">
      <Frame>
        <FrameHeader>Lista de Treinadores</FrameHeader>
        <Box padding="4">
          <Box
            alignItems="center"
            borderColor="border"
            borderRadius="sm"
            borderStyle="dashed"
            borderWidth="1px"
            color="fg.muted"
            cursor="pointer"
            display="flex"
            gap="3"
            padding="3"
          >
            <Text color="fg.subtle" variant="body">
              +
            </Text>
            <Text variant="label">Criar treinador</Text>
          </Box>
        </Box>
      </Frame>
    </Box>
  );
}
