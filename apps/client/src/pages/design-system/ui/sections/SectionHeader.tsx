import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';

type SectionHeaderProps = {
  description: string;
  id: string;
  title: string;
};

export function SectionHeader(props: SectionHeaderProps): ReactElement {
  const { description, id, title } = props;
  return (
    <Box id={id} marginBlockEnd="8" scrollMarginTop="5rem">
      <Text color="fg" variant="title">
        {title}
      </Text>
      <Text color="fg.muted" marginBlockStart="2" maxW="70ch" variant="bodyLarge">
        {description}
      </Text>
    </Box>
  );
}
