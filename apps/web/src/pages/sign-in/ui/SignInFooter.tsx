import { Link, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

export function SignInFooter(): React.ReactElement {
  return (
    <Text color="fg.muted" fontSize="sm" textAlign="center">
      New to Empirage?{" "}
      <Link asChild color="brand.emphasized" fontWeight="bold">
        <RouterLink to="/signup">Create an account</RouterLink>
      </Link>
    </Text>
  );
}
