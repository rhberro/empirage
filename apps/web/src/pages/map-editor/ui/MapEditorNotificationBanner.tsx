/* eslint-disable oxsome/no-inline-structural-types */
import { Box } from '@chakra-ui/react';

import type { StatusMessage } from './map-editor-logic';

interface BannerProps {
  message: StatusMessage | null;
}

export function MapEditorNotificationBanner(props: BannerProps): React.ReactElement | null {
  const { message } = props;
  if (!message) {
    return null;
  }
  const isStatusError = message.type === 'error';
  const bannerBg = isStatusError ? 'red.900' : 'green.900';
  const bannerBorder = isStatusError ? 'red.700' : 'green.700';

  return (
    <Box
      bg={bannerBg}
      borderBottom="1px solid"
      borderColor={bannerBorder}
      color="white"
      fontSize="xs"
      px="4"
      py="1.5"
      textAlign="center"
    >
      {message.text}
    </Box>
  );
}
