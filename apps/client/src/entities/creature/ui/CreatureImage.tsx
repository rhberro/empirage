import { Box } from '@chakra-ui/react';

import { useCreatureImage } from '~/entities/creature/model/useCreatureImage';

type CreatureImageProperties = { identifier: string };

export function CreatureImage(
  props: React.PropsWithChildren<CreatureImageProperties>,
): React.ReactElement {
  const { children, identifier } = props;
  const src = useCreatureImage(identifier);
  return (
    <Box border="none" bg="accent.arcane" outline="none" w="full">
      {children}
    </Box>
  );
}
