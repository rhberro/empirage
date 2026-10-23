import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';

const PORTRAIT_SIZE = '2.75rem';

type CreaturePortraitProps = {
  borderColor: string;
  level: number;
  textColor: string;
};

export function CreaturePortrait(props: CreaturePortraitProps): ReactElement {
  const { borderColor, level, textColor } = props;
  return (
    <Box
      alignItems="center"
      bg="bg.sunken"
      borderColor={borderColor}
      borderRadius="full"
      borderWidth="2px"
      boxShadow="recessed"
      color={textColor}
      display="flex"
      height={PORTRAIT_SIZE}
      justifyContent="center"
      width={PORTRAIT_SIZE}
    >
      <Text variant="numeric">{level}</Text>
    </Box>
  );
}
