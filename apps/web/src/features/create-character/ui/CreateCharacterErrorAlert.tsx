import { Alert } from '@chakra-ui/react';

type CreateCharacterErrorAlertProperties = {
  message: string | null;
};

export function CreateCharacterErrorAlert(
  props: CreateCharacterErrorAlertProperties,
): React.ReactElement | null {
  const { message } = props;

  if (!message) {
    return null;
  }

  return (
    <Alert.Root status="error" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
}
