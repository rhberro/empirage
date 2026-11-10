import { Text, type TextProps } from '@chakra-ui/react';

type IconProperties = TextProps & { name: string };

export function Icon(props: IconProperties): React.ReactElement {
  const { name, ...properties } = props;
  return (
    // oxlint-disable-next-line forbid-component-props
    <Text as="span" {...properties} className="material-symbols-rounded" aria-hidden="true">
      {name}
    </Text>
  );
}
