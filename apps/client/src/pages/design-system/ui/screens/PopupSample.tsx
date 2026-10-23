import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { IconCoin } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

export function PopupSample(): ReactElement {
  return (
    <Box width="15rem">
      <Box
        bg="bg.panel"
        borderColor="border.emphasized"
        borderRadius="sm"
        borderWidth="1px"
        boxShadow="overlay"
        padding="3"
      >
        <Text color="fg" variant="name">
          Poção de Cura
        </Text>
        <Box alignItems="center" color="currency.gold" display="flex" gap="1" marginBlockEnd="2">
          <IconCoin size="0.8125rem" />
          <Text variant="numeric">120</Text>
        </Box>
        <Text color="fg.muted" variant="body">
          Restaura 40 pontos de vida na criatura ativa.
        </Text>
      </Box>
    </Box>
  );
}
