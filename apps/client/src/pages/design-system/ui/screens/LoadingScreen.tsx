import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { LoadingScreen as GameLoadingScreen } from '~/shared/ui/loading';

export function LoadingScreen(): ReactElement {
  return (
    <Box width="32.5rem">
      <GameLoadingScreen minHeight="20rem" />
    </Box>
  );
}
