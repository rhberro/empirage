import type { StoreCatalog } from '@creatures/contracts/store';
import { useCallback, useMemo, useState } from 'react';

import type { StoreView } from '~/features/store/model/store.types';
import { isItemOwned, resolveSaleTotal, type StoreSale } from '~/features/store/model/storeSale';
import { useStoreCatalog } from '~/features/store/model/useStoreCatalog';
import { useStoreQuantity } from '~/features/store/model/useStoreQuantity';
import { computeStoreTotal, useStoreSelection } from '~/features/store/model/useStoreSelection';
import type { StoreOutcome } from '~/shared/api';

/**
 * The state of the store modal.
 *
 * The modal owns the catalog, the backpack and the wallet of the trainer: the
 * server is the source of all of them. Closing the modal or changing the tab
 * resets the selection, the quantity and the total.
 *
 * The catalog can come from outside — the gallery of the design system shows
 * the store with a catalog of samples — and then the modal does not ask the
 * server for it.
 */
export function useStore(
  isOpen: boolean,
  onClose: () => void,
  snapshot: StoreCatalog | null = null,
): StoreView {
  const catalog = useStoreCatalog(isOpen, snapshot);
  const selection = useStoreSelection();
  const quantity = useStoreQuantity();
  const [sale, setSale] = useState<StoreSale | null>(null);
  const resetAfterCommand = useStoreReset(selection, quantity);
  const buy = useStoreBuy(catalog, selection, quantity, resetAfterCommand);
  const sell = useStoreSell(catalog, selection, quantity, setSale);
  const close = useStoreClose(selection, quantity, setSale, onClose);
  const select = useStoreSelect(selection, quantity);
  const setTab = useStoreTabChange(selection, quantity, setSale);
  const total = useStoreTotal(catalog, selection, quantity, sale);
  return {
    bag: catalog.bag,
    buy,
    catalog: catalog.catalog,
    close,
    commitQuantity: quantity.commitQuantity,
    error: catalog.error,
    gold: catalog.gold,
    isBusy: catalog.isBusy,
    isLoading: catalog.isLoading,
    quantity: quantity.quantity,
    quantityText: quantity.quantityText,
    select,
    selectedBagItemId: selection.selectedBagItemId,
    selectedItemId: selection.selectedItemId,
    sell,
    setTab,
    stepQuantity: quantity.stepQuantity,
    tab: selection.tab,
    total,
    typeQuantity: quantity.typeQuantity,
  };
}

type CatalogView = ReturnType<typeof useStoreCatalog>;
type SelectionView = ReturnType<typeof useStoreSelection>;
type QuantityView = ReturnType<typeof useStoreQuantity>;

/**
 * The buy: the click buys the selected item, and the selection goes away.
 */
function useStoreBuy(
  catalog: CatalogView,
  selection: SelectionView,
  quantity: QuantityView,
  resetAfterCommand: () => void,
): () => void {
  return useCallback(
    function buySelected(): void {
      const itemId = selection.selectedItemId;
      if (itemId === null) {
        return;
      }
      catalog.buy(itemId, quantity.quantity, function afterBuy(): void {
        resetAfterCommand();
      });
    },
    [catalog, quantity.quantity, resetAfterCommand, selection],
  );
}

/**
 * The sale: the click sells the quantity the player chose of the selected
 * item.
 *
 * The selection stays when the item is still in the backpack: the player can
 * sell more of it without selecting it again. The item that leaves the
 * backpack entirely takes the selection with it, because its slot is gone.
 */
function useStoreSell(
  catalog: CatalogView,
  selection: SelectionView,
  quantity: QuantityView,
  onSold: (sale: StoreSale) => void,
): () => void {
  return useCallback(
    function sellSelected(): void {
      const itemId = selection.selectedBagItemId;
      if (itemId === null) {
        return;
      }
      const item = catalog.bag.find(function matches(entry: { itemId: string }): boolean {
        return entry.itemId === itemId;
      });
      if (item === undefined) {
        return;
      }
      const sold = quantity.quantity;
      catalog.sell(item.itemId, sold, function afterSale(outcome: StoreOutcome): void {
        if (!isItemOwned(outcome.bag, item.itemId)) {
          selection.clearSelection();
          quantity.reset();
        }
        onSold({ itemId: item.itemId, quantity: sold, total: outcome.total });
      });
    },
    [catalog, onSold, quantity, selection],
  );
}

/**
 * The state of the modal after a command: no selection, and the quantity
 * back to its first value.
 */
function useStoreReset(selection: SelectionView, quantity: QuantityView): () => void {
  return useCallback(
    function reset(): void {
      selection.clearSelection();
      quantity.reset();
    },
    [quantity, selection],
  );
}

/**
 * The close: the modal goes back to the buy tab, without a selection.
 */
function useStoreClose(
  selection: SelectionView,
  quantity: QuantityView,
  setSale: (sale: StoreSale | null) => void,
  onClose: () => void,
): () => void {
  return useCallback(
    function closeModal(): void {
      selection.setTab('buy');
      quantity.reset();
      setSale(null);
      onClose();
    },
    [onClose, quantity, selection, setSale],
  );
}

/**
 * The selection: a new item starts the quantity at one.
 */
function useStoreSelect(
  selection: SelectionView,
  quantity: QuantityView,
): (itemId: string) => void {
  return useCallback(
    function selectItem(itemId: string): void {
      selection.select(itemId);
      quantity.reset();
    },
    [quantity, selection],
  );
}

/**
 * The change of the tab takes the selection and the quantity away.
 */
function useStoreTabChange(
  selection: SelectionView,
  quantity: QuantityView,
  setSale: (sale: StoreSale | null) => void,
): (tab: StoreView['tab']) => void {
  return useCallback(
    function changeTab(tab: StoreView['tab']): void {
      selection.setTab(tab);
      quantity.reset();
      setSale(null);
    },
    [quantity, selection, setSale],
  );
}

/**
 * The gold the action of the current tab costs, or yields.
 *
 * The total of the sale is the one the server answered, when the sale the
 * server did is the sale the player is looking at.
 */
function useStoreTotal(
  catalog: CatalogView,
  selection: SelectionView,
  quantity: QuantityView,
  sale: StoreSale | null,
): number {
  return useMemo(
    function readTotal(): number {
      const local = computeStoreTotal(
        selection.tab,
        catalog.catalog,
        catalog.bag,
        selection.selectedItemId,
        selection.selectedBagItemId,
        quantity.quantity,
      );
      if (selection.tab !== 'sell') {
        return local;
      }
      return resolveSaleTotal(local, sale, selection.selectedBagItemId, quantity.quantity);
    },
    [catalog.bag, catalog.catalog, quantity.quantity, sale, selection],
  );
}
