import { Badge, HStack, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

type CollectionSectionProps = React.PropsWithChildren<{
  count: string;
  extra?: React.ReactNode;
  label: string;
}>;

export function CollectionSection(props: CollectionSectionProps): React.ReactElement {
  const { children, count, extra, label } = props;
  return (
    <Stack gap="3">
      <HStack justify="space-between">
        <HStack>
          <Text fontWeight="semibold">{label}</Text>
          <Badge>{count}</Badge>
        </HStack>
        {extra}
      </HStack>
      {children}
    </Stack>
  );
}
