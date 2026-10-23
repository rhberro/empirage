import type { ReactElement } from 'react';

import { LayerRoot } from '~/shared/ui/layer';

import type { DialogProps } from './dialog.types';

const DIALOG_WIDTH = '26.25rem';

/**
 * O dialogo de confirmacao.
 *
 * E a camada de peso curto: titulo a esquerda, largura apertada e sem botao
 * no canto. Fecha pelo ESC ou pelos botoes — clicar fora **nao** fecha, para
 * nao perder a decisao por um clique acidental.
 */
export function Dialog(props: DialogProps): ReactElement {
  const { children, contained = false, isOpen, label, onClose, width = DIALOG_WIDTH } = props;
  return (
    <LayerRoot
      contained={contained}
      isOpen={isOpen}
      label={label}
      onClose={onClose}
      weight="dialog"
      width={width}
    >
      {children}
    </LayerRoot>
  );
}
