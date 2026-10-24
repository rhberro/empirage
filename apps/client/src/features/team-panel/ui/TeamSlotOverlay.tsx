import { Box, Center } from '@chakra-ui/react';

import { Text } from '~/shared/ui/text';

export function TeamSlotOverlay(props: React.PropsWithChildren<unknown>): React.ReactElement {
  const { children } = props;
  return (
    <>
      <Center>
        <Text variant="section">{children}</Text>
      </Center>
      <Box bg="blackAlpha.300" zIndex="overlay" position="absolute" inset={0} />
    </>
  );
}
