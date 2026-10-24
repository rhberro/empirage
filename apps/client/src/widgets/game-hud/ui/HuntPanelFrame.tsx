import { Box } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

const PANEL_WIDTH = '18rem';

type HuntPanelFrameProps = {
  children?: ReactNode;
};

/**
 * The floating card the hunt panels share.
 *
 * It sits over the canvas, below the toolbar, without pushing it. The width is
 * fixed so the two panels stack without the content reflowing.
 */
export function HuntPanelFrame(props: HuntPanelFrameProps): ReactElement {
  const { children } = props;
  return (
    <Box
      bg="bg.panel"
      borderColor="border"
      borderRadius="l2"
      borderWidth="1px"
      boxShadow="raised"
      display="flex"
      flexDirection="column"
      gap="3"
      padding="4"
      width={PANEL_WIDTH}
    >
      {children}
    </Box>
  );
}
