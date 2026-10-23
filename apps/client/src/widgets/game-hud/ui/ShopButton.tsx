import type { ReactElement } from 'react';

import { Button } from '~/shared/ui/button';

type ShopButtonProps = {
  onClick: () => void;
};

export function ShopButton(props: ShopButtonProps): ReactElement {
  const { onClick } = props;
  return (
    <Button onClick={onClick} tone="primary">
      Loja da Cidade
    </Button>
  );
}
