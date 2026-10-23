import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';

const TITLE = 'Carregando';
const DESCRIPTION = 'Estamos preparando o seu treinador. Isso pode levar alguns instantes.';
const SPIN_DURATION = '900ms';
const SPIN_ANIMATION = `spin ${SPIN_DURATION} linear infinite`;

/**
 * The loading state of the screen of the game.
 *
 * It lives in the page: the gallery of the design system has its own sample,
 * and a page never imports from another page.
 */
export function PlayLoadingState(): ReactElement {
  return (
    <Box
      alignItems="center"
      bg="bg"
      display="flex"
      flexDirection="column"
      height="100dvh"
      justifyContent="center"
      width="100%"
    >
      <Text color="fg" variant="title">
        {TITLE}
      </Text>
      <Box
        animation={SPIN_ANIMATION}
        borderColor="accent.arcane"
        borderRadius="full"
        borderStyle="solid"
        borderTopColor="transparent"
        borderWidth="2px"
        height="1.75rem"
        marginBlockStart="6"
        width="1.75rem"
      />
      <Text color="fg.muted" marginBlockStart="4" maxW="42ch" textAlign="center" variant="body">
        {DESCRIPTION}
      </Text>
    </Box>
  );
}
