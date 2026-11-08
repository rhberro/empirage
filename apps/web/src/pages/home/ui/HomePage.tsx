import { Button, Center } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

import { signOut } from '~/shared/auth';
import { GameTitle } from '~/shared/ui/GameTitle';

/**
 * This page is just a temporary placeholder for a landing page that  might come in the future.
 */
export function HomePage(): React.ReactElement {
  return (
    <Center flexDirection="column" gap="4" h="dvh">
      <GameTitle />
      <Button asChild variant="surface" w="xs">
        <Link to="/characters">Enter Game</Link>
      </Button>
      <Button asChild variant="surface" w="xs">
        <Link to="/signin">Sign In</Link>
        Sign In
      </Button>
      <Button asChild variant="surface" w="xs">
        <Link to="/signup">Sign Up</Link>
        Sign Up
      </Button>
      <Button onClick={signOut} variant="surface" w="xs">
        Sign Out
      </Button>
    </Center>
  );
}
