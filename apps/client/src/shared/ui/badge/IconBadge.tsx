import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { IconBadgeProps } from './badge.types';

const BADGE_SIZE = '1.75rem';

export function IconBadge(props: IconBadgeProps): ReactElement {
  const { children, size = BADGE_SIZE, tone = 'fg.muted' } = props;
  return (
    <Box
      alignItems="center"
      bg="bg.raised"
      borderRadius="sm"
      color={tone}
      display="flex"
      flexShrink="0"
      height={size}
      justifyContent="center"
      width={size}
    >
      {children}
    </Box>
  );
}
