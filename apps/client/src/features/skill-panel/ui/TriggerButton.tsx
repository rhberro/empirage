import type { ReactElement } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { Text } from '~/shared/ui/text';

type TriggerButtonProps = {
  label: string;
  onPress: () => void;
};

export function TriggerButton(props: TriggerButtonProps): ReactElement {
  const { label, onPress } = props;
  return (
    <NativeButton
      alignItems="center"
      aria-label={label}
      bg="bg.raised"
      borderColor="border"
      borderRadius="sm"
      borderWidth="1px"
      color="fg.muted"
      cursor="pointer"
      display="flex"
      height="1.625rem"
      justifyContent="center"
      width="1.625rem"
      onClick={onPress}
    >
      <Text variant="numeric">{label}</Text>
    </NativeButton>
  );
}
