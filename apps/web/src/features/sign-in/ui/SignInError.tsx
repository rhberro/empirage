import { Alert } from '@chakra-ui/react';

import { selectAuthError, useAuthStore } from '~/shared/auth';

export function SignInError(): React.ReactElement | null {
  const error = useAuthStore(selectAuthError);

  if (!error) {
    return null;
  }

  return (
    <Alert.Root status="error" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>
          Não foi possível entrar. Verifique seus dados e tente novamente.
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
}
