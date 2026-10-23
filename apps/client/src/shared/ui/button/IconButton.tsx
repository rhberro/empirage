import type { ReactElement } from 'react';

import { ICON_BUTTON_TONE } from './iconButton.constants';
import type { IconButtonProps } from './iconButton.types';
import { NativeButton } from './NativeButton';

const ICON_BUTTON_SIZE = '2.75rem';

/**
 * The button of an icon.
 *
 * O botao e um `<button>` de verdade, com o alvo minimo de toque, e as props
 * que sobram vao para o elemento: e o que permite envolver o botao em um
 * popup, que precisa dos gatilhos dele no mesmo elemento.
 */
export function IconButton(props: IconButtonProps): ReactElement {
  const {
    children,
    label,
    onClick,
    radius = 'sm',
    size = ICON_BUTTON_SIZE,
    tone = 'neutral',
    ...rest
  } = props;
  const colors = ICON_BUTTON_TONE[tone];
  const hover = { bg: colors.hoverBackground, color: colors.hoverColor };
  return (
    <NativeButton
      _hover={hover}
      alignItems="center"
      aria-label={label}
      bg={colors.background}
      borderColor={colors.borderColor}
      borderRadius={radius}
      borderWidth={colors.borderWidth}
      boxShadow={colors.boxShadow}
      color={colors.color}
      cursor="pointer"
      display="flex"
      height={size}
      justifyContent="center"
      title={label}
      transitionProperty="background-color, color"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width={size}
      onClick={onClick}
      {...rest}
    >
      {children}
    </NativeButton>
  );
}
