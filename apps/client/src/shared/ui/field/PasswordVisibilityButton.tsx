import type { ReactElement } from 'react';

import { NativeButton } from '~/shared/ui/button';

import { EyeIcon, EyeOffIcon } from './passwordField.icons';

const BUTTON_SIZE = '2.75rem';
const ICON_SIZE = '1rem';

const HOVER_STYLE = {
  color: 'fg',
};

type PasswordVisibilityButtonProps = {
  isVisible: boolean;
  label: string;
  onToggle: () => void;
};

/**
 * O botão que mostra e oculta a senha.
 *
 * É um `<button>` de verdade: o leitor de tela anuncia o rótulo, e o clique
 * troca o tipo do input. O alvo tem 2.75rem, mesmo com o ícone de 1rem — o alvo
 * é maior que o elemento visível.
 */
export function PasswordVisibilityButton(props: PasswordVisibilityButtonProps): ReactElement {
  const { isVisible, label, onToggle } = props;
  const icon = isVisible ? <EyeOffIcon size={ICON_SIZE} /> : <EyeIcon size={ICON_SIZE} />;

  return (
    <NativeButton
      _hover={HOVER_STYLE}
      alignItems="center"
      aria-label={label}
      aria-pressed={isVisible}
      color="fg.subtle"
      cursor="pointer"
      display="flex"
      height={BUTTON_SIZE}
      justifyContent="center"
      position="absolute"
      right="0"
      title={label}
      top="50%"
      transform="translateY(-50%)"
      transitionProperty="color"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width={BUTTON_SIZE}
      zIndex="1"
      onClick={onToggle}
    >
      {icon}
    </NativeButton>
  );
}
