import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { IconBag, IconChest } from '~/shared/ui/icon';

import { ToolbarButton } from './ToolbarButton';
import { ToolbarIdentity } from './ToolbarIdentity';

type ToolbarLeftProps = {
  onOpenBackpack: () => void;
  onOpenStorage: () => void;
  trainerLevel: number;
  trainerName: string;
};

export function ToolbarLeft(props: ToolbarLeftProps): ReactElement {
  const { onOpenBackpack, onOpenStorage, trainerLevel, trainerName } = props;
  return (
    <Box alignItems="center" display="flex" gap="4">
      <ToolbarIdentity level={trainerLevel} name={trainerName} />
      <Box bg="border" height="1.75rem" width="1px" />
      <Box alignItems="center" display="flex" gap="1">
        <ToolbarButton label="Mochila" onClick={onOpenBackpack}>
          <IconBag size="1.25rem" />
        </ToolbarButton>
        <ToolbarButton label="Armazenamento" onClick={onOpenStorage}>
          <IconChest size="1.25rem" />
        </ToolbarButton>
      </Box>
    </Box>
  );
}
