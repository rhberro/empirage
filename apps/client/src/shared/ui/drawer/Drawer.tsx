import type { ReactElement } from 'react';

import { LayerRoot } from '~/shared/ui/layer';

import type { DrawerProps } from './drawer.types';

const DRAWER_WIDTH = '20rem';

/**
 * O drawer: a lateral.
 *
 * Encostada na borda direita e da altura da tela inteira, com cabecalho e
 * rodape fixos e o corpo rolando. O botao de fechar mora dentro da lateral,
 * porque ela nao tem folga em volta como o modal. Fecha pelo ESC e pelo
 * clique no fundo.
 */
export function Drawer(props: DrawerProps): ReactElement {
  const {
    children,
    contained = false,
    height,
    isOpen,
    label,
    onClose,
    width = DRAWER_WIDTH,
  } = props;
  return (
    <LayerRoot
      closable
      contained={contained}
      height={height}
      isOpen={isOpen}
      label={label}
      onClose={onClose}
      weight="drawer"
      width={width}
    >
      {children}
    </LayerRoot>
  );
}
