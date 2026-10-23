import type { ReactElement } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { IconClose } from '~/shared/ui/icon';

const CLOSE_SIZE = '2rem';
const ICON_SIZE = '1rem';

type AlertCloseProps = {
  onClick: () => void;
};

export function AlertClose(props: AlertCloseProps): ReactElement {
  const { onClick } = props;
  return (
    <NativeButton
      alignItems="center"
      aria-label="Fechar aviso"
      bg="bg.raised"
      borderColor="border"
      borderRadius="full"
      borderWidth="1px"
      color="fg.muted"
      cursor="pointer"
      display="flex"
      flexShrink="0"
      height={CLOSE_SIZE}
      justifyContent="center"
      transitionProperty="background-color, color"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width={CLOSE_SIZE}
      onClick={onClick}
    >
      <IconClose size={ICON_SIZE} />
    </NativeButton>
  );
}
