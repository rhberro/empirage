import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

const EMPTY_WIDTH = '5.75rem';

export function EmptyCreatureTab(): ReactElement {
  return (
    <Box
      bg="bg.panel"
      borderColor="border"
      borderRadius="sm"
      borderStyle="solid"
      borderWidth="1px"
      boxShadow="raised"
      minH="5.25rem"
      opacity={0.55}
      width={EMPTY_WIDTH}
    />
  );
}
