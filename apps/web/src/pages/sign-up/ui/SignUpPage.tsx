import { Link } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

export function SignUpPage(): React.ReactElement {
  return (
    <div>
      Sign Up!
      <p>
        Go to
        <Link asChild color="brand.emphasized" fontWeight="bold">
          <RouterLink to="/signin">Sign In!</RouterLink>
        </Link>
      </p>
    </div>
  );
}
