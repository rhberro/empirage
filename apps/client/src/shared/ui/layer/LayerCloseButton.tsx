import { Box, type SystemStyleObject } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { IconButton } from '~/shared/ui/button';
import { IconClose } from '~/shared/ui/icon';

const CLOSE_ICON_SIZE = '1rem';
const CLOSE_SIZE = '2.75rem';

export type LayerCloseButtonProps = {
  closeStyles: SystemStyleObject;
  onClose: () => void;
};

export function LayerCloseButton(props: LayerCloseButtonProps): ReactElement {
  const { closeStyles, onClose } = props;
  return (
    <Box css={closeStyles}>
      <IconButton label="Fechar" onClick={onClose} radius="full" size={CLOSE_SIZE} tone="neutral">
        <IconClose size={CLOSE_ICON_SIZE} />
      </IconButton>
    </Box>
  );
}
