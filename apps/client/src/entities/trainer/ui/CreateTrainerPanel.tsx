import { Box } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

import { Frame, FrameHeader } from '~/shared/ui/frame';

const TITLE = 'Criar Treinador';
const PANEL_WIDTH = '22.5rem';

type CreateTrainerPanelProps = {
  children: ReactNode;
};

export function CreateTrainerPanel(props: CreateTrainerPanelProps): ReactElement {
  const { children } = props;
  return (
    <Box width={PANEL_WIDTH}>
      <Frame tone="overlay">
        <FrameHeader>{TITLE}</FrameHeader>
        <Box display="flex" flexDirection="column" gap="5" padding="5">
          {children}
        </Box>
      </Frame>
    </Box>
  );
}
