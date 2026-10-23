import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { IconChevronRight } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

const PLAY_WIDTH = '21.25rem';
const PLAY_HEIGHT = '6.5rem';
const PLAY_BOTTOM = '8rem';
const CHEVRON_SIZE = '2.125rem';

type PlayButtonProps = {
  onClick: () => void;
};

export function PlayButton(props: PlayButtonProps): ReactElement {
  const { onClick } = props;
  return (
    <Box
      alignItems="center"
      bg="bg.panel"
      borderColor="border"
      borderBottomRightRadius="lg"
      borderRadius="0"
      borderTopRightRadius="lg"
      borderWidth="1px"
      borderLeftWidth="0"
      boxShadow="raised"
      color="arcane.50"
      cursor="pointer"
      display="flex"
      gap="4"
      height={PLAY_HEIGHT}
      left="0"
      paddingInline="6"
      position="absolute"
      bottom={PLAY_BOTTOM}
      transitionProperty="background-color"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width={PLAY_WIDTH}
      onClick={onClick}
    >
      <Box color="gold.400" display="flex" flexShrink="0">
        <IconChevronRight size={CHEVRON_SIZE} />
      </Box>
      <Box>
        <Text color="gold.400" variant="label">
          Caçar
        </Text>
        <Text color="arcane.50" variant="display">
          Explorar
        </Text>
      </Box>
    </Box>
  );
}
