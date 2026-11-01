import { Link as ChakraLink } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

export function SignUpPage(): React.ReactElement {
  return (
    <div>
      Sign Up!
      <p>
        Go to
        <ChakraLink as={Link} to="/signin">
          Sign In!
        </ChakraLink>
      </p>
    </div>
  );
}
