import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { NativeButton } from '~/shared/ui/button';

const STEP_HEIGHT = '2rem';
const STEP_HOVER = { bg: 'bg.emphasized', color: 'fg' };
const DISABLED_STYLE = {
  _disabled: { color: 'fg.subtle', opacity: 0.5 },
  _hover: {},
  color: 'fg.muted',
  cursor: 'not-allowed',
  opacity: 0.5,
};
const ACTIVE_STYLE = {
  _hover: STEP_HOVER,
  color: 'fg.muted',
  cursor: 'pointer',
  opacity: 1,
};

type StoreQuantityButtonProps = ComponentProps<typeof NativeButton> & {
  children: ReactNode;
};

/**
 * The button of a step of the quantity.
 *
 * O botao do `-` e do `+` do campo e o botao do `+10` e do `MAX` sao o mesmo
 * botao: e o que faz o campo e os passos parecerem da mesma origem, e nao
 * dois controles colados um no outro.
 *
 * The disabled state is born here too, and it does not depend on how the
 * disabledness arrives: the explicit `disabled` prop of the steps and the
 * data-disabled que o `NumberInput` escreve nos gatilhos do campo caem no
 * mesmo estilo, so a closed quantity field never looks alive in one control
 * and dimmed in the other.
 */
export function StoreQuantityButton(props: StoreQuantityButtonProps): ReactElement {
  const { children, disabled = false, ...rest } = props;
  return (
    <NativeButton
      alignItems="center"
      bg="bg.raised"
      borderColor="border"
      borderRadius="sm"
      borderWidth="1px"
      disabled={disabled}
      display="flex"
      height={STEP_HEIGHT}
      justifyContent="center"
      minW={STEP_HEIGHT}
      paddingInline="2"
      {...(disabled ? DISABLED_STYLE : ACTIVE_STYLE)}
      {...rest}
    >
      {children}
    </NativeButton>
  );
}
