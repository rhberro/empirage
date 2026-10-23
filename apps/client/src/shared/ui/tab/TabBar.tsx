import { Tabs as ChakraTabs } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

type TabBarProps = {
  children: ReactNode;
};

export function TabBar(props: TabBarProps): ReactElement {
  const { children } = props;
  return (
    <ChakraTabs.List display="flex" gap="1" overflowX="auto" scrollbarWidth="none">
      {children}
    </ChakraTabs.List>
  );
}
