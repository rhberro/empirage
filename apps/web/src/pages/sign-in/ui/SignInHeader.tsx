import { Box, Heading, Text } from "@chakra-ui/react";

export function SignInHeader(): React.ReactElement {
  return (
    <Box>
      <Text
        color="brand.solid"
        fontFamily="ui"
        fontSize="sm"
        fontWeight="bold"
        letterSpacing="wide"
      >
        SIGN IN
      </Text>
      <Heading color="fg.default" fontSize="2xl" mt="2">
        Welcome back
      </Heading>
      <Text color="fg.muted" mt="2">
        Enter your credentials to access your account.
      </Text>
    </Box>
  );
}
