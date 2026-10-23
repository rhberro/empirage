import type { ReactNode } from 'react';

export type PressableProps = {
  children: ReactNode;
  disabled?: boolean;
  /** The height of the pressable, quando ele ocupa a linha inteira. */
  height?: string;
  onPress: () => void;
  radius?: string;
  width?: string;
};
