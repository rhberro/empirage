import { Box, Progress, Stack, Text } from '@chakra-ui/react';

import { GameTitle } from '~/shared/ui/GameTitle';

type TransitionLoadingScreenProps = { message: string };

export function TransitionLoadingScreen(props: TransitionLoadingScreenProps): React.ReactElement {
  const { message } = props;
  return (
    <Box
      alignItems="center"
      bg="black"
      display="flex"
      inset="0"
      justifyContent="center"
      position="fixed"
      zIndex="10"
    >
      <Stack align="center" gap="8" maxW="sm" px="6" w="full">
        <GameTitle />
        <Stack gap="3" w="full">
          <Progress.Root value={null} w="full">
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text color="fg.muted" textAlign="center">
            {message}
          </Text>
        </Stack>
      </Stack>
    </Box>
  );
}
