import { Icon as ChakraIcon, IconProps } from '@chakra-ui/react';

type IconProperties = IconProps & { name: string };

export function Icon(props: IconProperties): React.ReactElement {
  const { name, ...properties } = props;
  return (
    <ChakraIcon {...properties}>
      <span className="material-symbols-rounded" aria-hidden="true">
        {name}
      </span>
    </ChakraIcon>
  );
}
