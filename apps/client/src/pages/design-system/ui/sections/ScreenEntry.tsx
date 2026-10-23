import { Box } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

import { Text } from '~/shared/ui/text';

type ScreenEntryProps = {
  children: ReactNode;
  description: string;
  frameMinHeight?: string;
  id: string;
  title: string;
};

/**
 * Um item da lista de telas: o rotulo com o alvo de ancora e a preview embaixo.
 *
 * Cada tela ocupa a linha inteira, entao a preview nunca compete com a vizinha.
 *
 * As camadas (modal, drawer) ficam `contained`: o positioner e absoluto, entao o
 * container precisa de uma altura minima para elas nao colapsarem.
 */
export function ScreenEntry(props: ScreenEntryProps): ReactElement {
  const { children, description, frameMinHeight, id, title } = props;
  return (
    <Box id={id} minW="0" scrollMarginTop="5rem">
      <Box marginBlockEnd="4">
        <Text color="fg" variant="name">
          {title}
        </Text>
        <Text color="fg.muted" marginBlockStart="1" maxW="70ch" variant="body">
          {description}
        </Text>
      </Box>
      <Box minH={frameMinHeight} minW="0" overflow="hidden" position="relative">
        {children}
      </Box>
    </Box>
  );
}
