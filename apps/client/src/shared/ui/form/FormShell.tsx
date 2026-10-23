import { Box } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

import { DIVIDER_BOTTOM } from '~/shared/theme';
import { Frame, FrameFooter } from '~/shared/ui/frame';
import { Text } from '~/shared/ui/text';

const SHELL_WIDTH = '22.5rem';

type FormShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  title: string;
};

export function FormShell(props: FormShellProps): ReactElement {
  const { children, footer, title } = props;
  const shellFooter = footer ? <FrameFooter>{footer}</FrameFooter> : null;
  return (
    <Box maxW="full" width={SHELL_WIDTH}>
      <Frame tone="overlay">
        <FormShellHeader title={title} />
        <Box display="flex" flexDirection="column" gap="4" padding="5">
          {children}
        </Box>
        {shellFooter}
      </Frame>
    </Box>
  );
}

type FormShellHeaderProps = {
  title: string;
};

function FormShellHeader(props: FormShellHeaderProps): ReactElement {
  const { title } = props;
  return (
    <Box css={DIVIDER_BOTTOM} padding="3" textAlign="center">
      <Text as="h2" color="fg" variant="section">
        {title}
      </Text>
    </Box>
  );
}
