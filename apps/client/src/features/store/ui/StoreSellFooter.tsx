import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { StoreView } from '~/features/store/model/store.types';
import { StoreQuantityField } from '~/features/store/ui/StoreQuantityField';
import { StoreQuantitySteps } from '~/features/store/ui/StoreQuantitySteps';
import { StoreTotal } from '~/features/store/ui/StoreTotal';
import { Button } from '~/shared/ui/button';

const SELL_ACTION_LABEL = 'Vender Selecionado';

type StoreSellFooterProps = {
  store: StoreView;
};

/**
 * The footer of the sell tab.
 *
 * The footer is the one of the buy tab: the quantity and the steps of the sum
 * are on the left, and the total of the quantity and the action are on the
 * right. The total is the value of the quantity the player is selling, and the
 * price of the unit is the one the popup shows.
 */
export function StoreSellFooter(props: StoreSellFooterProps): ReactElement {
  const { store } = props;
  const isDisabled = store.selectedBagItemId === null || store.isBusy;
  const isFieldDisabled = store.selectedBagItemId === null;
  const field = (
    <StoreQuantityField
      disabled={isFieldDisabled}
      limit={store.quantityLimit}
      onChange={store.typeQuantity}
      onCommit={store.commitQuantity}
      quantityText={store.quantityText}
    />
  );
  const steps = (
    <StoreQuantitySteps
      disabled={isFieldDisabled}
      limit={store.quantityLimit}
      onMax={store.setMaxQuantity}
      onStep={store.stepQuantity}
    />
  );
  const total = <StoreTotal value={store.total} />;
  const action = (
    <Button disabled={isDisabled} loading={store.isBusy} onClick={store.sell} tone="primary">
      {SELL_ACTION_LABEL}
    </Button>
  );
  const right = (
    <Box alignItems="center" display="flex" gap="4" marginInlineStart="auto">
      {total}
      {action}
    </Box>
  );
  return (
    <>
      {field}
      {steps}
      {right}
    </>
  );
}
