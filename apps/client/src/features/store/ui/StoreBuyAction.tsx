import { Box, Tooltip } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { StoreView } from '~/features/store/model/store.types';
import { Button } from '~/shared/ui/button';

const BUY_LABEL = 'Comprar';
const INSUFFICIENT_GOLD_MESSAGE = 'Você não tem dinheiro suficiente';

type StoreBuyActionProps = {
  store: StoreView;
};

/**
 * The buy button.
 *
 * Without money the button is disabled, and the tooltip says why: the player
 * has to know that the button will not work before clicking it.
 */
export function StoreBuyAction(props: StoreBuyActionProps): ReactElement {
  const { store } = props;
  const hasSelection = store.selectedItemId !== null;
  const hasGold = store.gold >= store.total;
  const isDisabled = !hasSelection || !hasGold || store.isBusy;
  const needsGold = hasSelection && !hasGold;
  const button = (
    <Button disabled={isDisabled} loading={store.isBusy} onClick={store.buy} tone="primary">
      {BUY_LABEL}
    </Button>
  );
  if (!needsGold) {
    return button;
  }
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Box as="span" display="inline-flex" tabIndex={0}>
          {button}
        </Box>
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content
          bg="bg.raised"
          borderColor="border.emphasized"
          borderRadius="sm"
          borderWidth="1px"
          color="fg"
          fontSize="sm"
          padding="2"
        >
          {INSUFFICIENT_GOLD_MESSAGE}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
