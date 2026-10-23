import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Frame, FrameHeader } from '~/shared/ui/frame';
import { Text } from '~/shared/ui/text';

export function LayerModes(): ReactElement {
  return (
    <Box display="flex" gap="5">
      <Box width="13.75rem">
        <Text color="fg.muted" marginBlockEnd="2" variant="meta">
          Painel simples
        </Text>
        <Frame>
          <FrameHeader>Seleção</FrameHeader>
          <Box padding="3">
            <Text color="fg.muted" variant="body">
              Fecha ao clicar fora.
            </Text>
          </Box>
        </Frame>
      </Box>
      <Box width="13.75rem">
        <Text color="fg.muted" marginBlockEnd="2" variant="meta">
          Modal composto
        </Text>
        <Frame tone="overlay">
          <FrameHeader>Mochila</FrameHeader>
          <Box padding="3">
            <Text color="fg.muted" variant="body">
              Fecha só por ESC ou pelo botão.
            </Text>
          </Box>
        </Frame>
      </Box>
    </Box>
  );
}
