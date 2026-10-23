import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { StoreView } from '~/features/store/model/store.types';
import { StoreBuyAction } from '~/features/store/ui/StoreBuyAction';
import { StoreQuantityField } from '~/features/store/ui/StoreQuantityField';
import { StoreQuantitySteps } from '~/features/store/ui/StoreQuantitySteps';
import { StoreTotal } from '~/features/store/ui/StoreTotal';

type StoreBuyFooterProps = {
  store: StoreView;
};

/**
 * The footer of the buy tab.
 *
 * The quantity and the steps of the sum are on the left, and the total and the
 * action are on the right.
 */
export function StoreBuyFooter(props: StoreBuyFooterProps): ReactElement {
  const { store } = props;
  const isDisabled = store.selectedItemId === null;
  const field = (
    <StoreQuantityField
      disabled={isDisabled}
      limit={store.quantityLimit}
      onChange={store.typeQuantity}
      onCommit={store.commitQuantity}
      quantityText={store.quantityText}
    />
  );
  const steps = (
    <StoreQuantitySteps
      disabled={isDisabled}
      limit={store.quantityLimit}
      onMax={store.setMaxQuantity}
      onStep={store.stepQuantity}
    />
  );
  const total = <StoreTotal value={store.total} />;
  const action = <StoreBuyAction store={store} />;
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
