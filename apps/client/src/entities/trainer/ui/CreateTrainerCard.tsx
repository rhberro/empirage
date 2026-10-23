import type { ReactElement } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { Text } from '~/shared/ui/text';

import { CARD_HOVER } from './createTrainerCard.constants';

type CreateTrainerCardProps = {
  onCreate: () => void;
};

export function CreateTrainerCard(props: CreateTrainerCardProps): ReactElement {
  const { onCreate } = props;
  return (
    <NativeButton
      _hover={CARD_HOVER}
      alignItems="center"
      borderColor="border"
      borderRadius="sm"
      borderStyle="dashed"
      borderWidth="1px"
      color="fg.muted"
      cursor="pointer"
      display="flex"
      justifyContent="center"
      minH="4.75rem"
      padding="2"
      transitionProperty="background-color, border-color, color"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width="full"
      onClick={onCreate}
    >
      <Text variant="label">Criar Treinador</Text>
    </NativeButton>
  );
}
