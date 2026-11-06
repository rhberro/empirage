import { Icon as ChakraIcon, IconProps } from '@chakra-ui/react';

type IconProperties = IconProps & { name: string };

export function Icon(props: IconProperties): React.ReactElement {
  const { name, ...iconProperties } = props;
  return (
    <ChakraIcon {...iconProperties}>
      <span className="material-symbols-rounded" aria-hidden="true">
        {name}
      </span>
    </ChakraIcon>
  );
}
