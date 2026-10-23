import type { Button as ChakraButton } from '@chakra-ui/react';
import type { ComponentProps, ReactElement } from 'react';

export type IconButtonProps = Omit<ComponentProps<typeof ChakraButton>, 'children' | 'onClick'> & {
  children: ReactElement;
  label: string;
  onClick: () => void;
  radius?: string;
  size?: string;
  tone?: IconButtonTone;
};

export type IconButtonTone =
  | 'danger'
  | 'dangerGhost'
  | 'ghost'
  | 'neutral'
  | 'primary'
  | 'secondary';
