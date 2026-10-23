import type { ReactElement } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { IconClose } from '~/shared/ui/icon';

const CLEAR_SIZE = '0.875rem';
const CLEAR_TARGET = '1.5rem';
const CLEAR_OFFSET = '0.4375rem';

type ClearControlProps = {
  /**
   * A distância do X até a borda direita do campo.
   *
   * O campo de senha usa um valor maior, porque o botão de visibilidade
   * ocupa a ponta direita.
   */
  offset?: string;
  onClick: () => void;
};

/**
 * O X que limpa o campo.
 *
 * E um `<button>` de verdade: um `Box` com `onClick` nao responde a Enter nem
 * a Espaco, nao some do foco e o leitor de tela anuncia uma div.
 */
export function ClearControl(props: ClearControlProps): ReactElement {
  const { offset = CLEAR_OFFSET, onClick } = props;
  return (
    <NativeButton
      alignItems="center"
      aria-label="Limpar campo"
      color="fg.subtle"
      cursor="pointer"
      display="flex"
      height={CLEAR_TARGET}
      justifyContent="center"
      position="absolute"
      right={offset}
      top="0.4375rem"
      transitionProperty="color"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width={CLEAR_TARGET}
      zIndex="1"
      onClick={onClick}
    >
      <IconClose size={CLEAR_SIZE} />
    </NativeButton>
  );
}
