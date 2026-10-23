import type { ReactElement } from 'react';

import { Button } from '~/shared/ui/button';

type IconButtonSampleProps = {
  children: ReactElement;
  label: string;
};

export function IconButtonSample(props: IconButtonSampleProps): ReactElement {
  const { children, label } = props;
  return (
    <Button aria-label={label} bg="bg.raised" minW="2.75rem" padding="0" tone="ghost">
      {children}
    </Button>
  );
}
