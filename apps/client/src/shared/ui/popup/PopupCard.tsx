import { Box } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

import { PANEL_MAX_WIDTH, PANEL_WIDTH } from './popup.constants';

type PopupCardProps = {
  children: ReactNode;
  width?: string;
};

/**
 * The surface of the popup, without the popup.
 *
 * A galeria mostra a superficie do painel sem o comportamento: o desenho e o
 * que se ve, e o `Popup` e o que o faz aparecer.
 */
export function PopupCard(props: PopupCardProps): ReactElement {
  const { children, width = PANEL_WIDTH } = props;
  return (
    <Box
      bg="bg.panel"
      borderColor="border.emphasized"
      borderRadius="sm"
      borderWidth="1px"
      boxShadow="overlay"
      maxW={PANEL_MAX_WIDTH}
      padding="3"
      width={width}
    >
      {children}
    </Box>
  );
}
