import type { ReactElement } from 'react';

import { IconButton } from '~/shared/ui/button';
import { Popup } from '~/shared/ui/popup';
import { Text } from '~/shared/ui/text';

export type ToolbarButtonProps = {
  /** The icon of the botao. */
  children: ReactElement;
  /** The name da acao, que e o que o popup mostra. */
  label: string;
  onClick: () => void;
};

/**
 * The button of the toolbar.
 *
 * O botao e redondo, como o de fechar do modal, e o alvo dele continua do
 * tamanho minimo de toque. O popup diz o que o botao faz: o `title` do
 * navegador demora e some sozinho, e o nome da acao e o que o jogador precisa
 * enquanto o cursor esta no botao.
 */
export function ToolbarButton(props: ToolbarButtonProps): ReactElement {
  const { children, label, onClick } = props;
  const content = (
    <Text color="fg" variant="meta">
      {label}
    </Text>
  );
  return (
    <Popup content={content}>
      <IconButton label={label} onClick={onClick} radius="full" tone="neutral">
        {children}
      </IconButton>
    </Popup>
  );
}
