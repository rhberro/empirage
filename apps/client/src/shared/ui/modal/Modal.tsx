import type { ReactElement } from 'react';

import { LayerRoot } from '~/shared/ui/layer';

import type { ModalProps } from './modal.types';

const MODAL_WIDTH = '40rem';

/**
 * O modal: a tela com conteudo interno.
 *
 * Titulo centralizado, corpo rolando e botao de fechar no canto. Clicar fora
 * **nao** fecha.
 */
export function Modal(props: ModalProps): ReactElement {
  const {
    children,
    contained = false,
    height,
    isOpen,
    label,
    onClose,
    width = MODAL_WIDTH,
  } = props;
  return (
    <LayerRoot
      closable
      contained={contained}
      height={height}
      isOpen={isOpen}
      label={label}
      onClose={onClose}
      weight="modal"
      width={width}
    >
      {children}
    </LayerRoot>
  );
}
