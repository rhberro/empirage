import { Link as ChakraLink } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

import { SignInForm } from './SignInForm';

export function SignInPage(): React.ReactElement {
  return (
    <div>
      Sign In!
      <p>
        Go to
        <ChakraLink as={Link} to="/signup">
          Sign Up!
        </ChakraLink>
      </p>
      <SignInForm />
    </div>
  );
}
