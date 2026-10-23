import type { StoreCatalog } from '@creatures/contracts/store';
import { useCallback, useMemo, useState } from 'react';

import type { StoreView } from '~/features/store/model/store.types';
import { buildPurchaseAlert, buildSaleAlert } from '~/features/store/model/storeAlerts';
import { computeQuantityLimit } from '~/features/store/model/storeQuantity';
import { isItemOwned, resolveSaleTotal, type StoreSale } from '~/features/store/model/storeSale';
import { useStoreCatalog } from '~/features/store/model/useStoreCatalog';
import { useStoreQuantity } from '~/features/store/model/useStoreQuantity';
import { computeStoreTotal, useStoreSelection } from '~/features/store/model/useStoreSelection';
import type { StoreOutcome } from '~/shared/api';
import { useAlerts } from '~/shared/ui/alert';
import type { AlertInput } from '~/shared/ui/alert';

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
  const limit = useStoreQuantityLimit(catalog, selection);
  const quantity = useStoreQuantity(limit);
  const { show } = useAlerts();
  const [sale, setSale] = useState<StoreSale | null>(null);
  const resetAfterCommand = useStoreReset(selection, quantity);
  const buy = useStoreBuy(catalog, selection, quantity, resetAfterCommand, show);
  const sell = useStoreSell(catalog, selection, quantity, setSale, show);
  const close = useStoreClose(selection, quantity, setSale, onClose);
  const select = useStoreSelect(selection, quantity);
  const setTab = useStoreTabChange(selection, quantity, setSale);
  const total = useStoreTotal(catalog, selection, quantity, sale);
  return {
    bag: catalog.bag,
    buy,
    catalog: catalog.catalog,
    clearSelection: selection.clearSelection,
    close,
    commitQuantity: quantity.commitQuantity,
    error: catalog.error,
    gold: catalog.gold,
    isBusy: catalog.isBusy,
    isLoading: catalog.isLoading,
    quantity: quantity.quantity,
    quantityLimit: limit,
    quantityText: quantity.quantityText,
    select,
    selectedBagItemId: selection.selectedBagItemId,
    selectedItemId: selection.selectedItemId,
    sell,
    setMaxQuantity: quantity.setMaxQuantity,
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
 * The limit of the quantity: what the player can afford, or what he has.
 */
function useStoreQuantityLimit(catalog: CatalogView, selection: SelectionView): number {
  return useMemo(
    function readLimit(): number {
      return computeQuantityLimit(
        selection.tab,
        catalog.catalog,
        catalog.bag,
        selection.selectedItemId,
        selection.selectedBagItemId,
        catalog.gold,
      );
    },
    [
      catalog.bag,
      catalog.catalog,
      catalog.gold,
      selection.selectedBagItemId,
      selection.selectedItemId,
      selection.tab,
    ],
  );
}

/**
 * The buy: the click buys the selected item, and the selection goes away.
 */
function useStoreBuy(
  catalog: CatalogView,
  selection: SelectionView,
  quantity: QuantityView,
  resetAfterCommand: () => void,
  show: (input: AlertInput) => string,
): () => void {
  return useCallback(
    function buySelected(): void {
      const itemId = selection.selectedItemId;
      if (itemId === null) {
        return;
      }
      const item = catalog.catalog.find(function matches(entry: { id: string }): boolean {
        return entry.id === itemId;
      });
      if (item === undefined) {
        return;
      }
      const bought = quantity.quantity;
      catalog.buy(itemId, bought, function afterBuy(): void {
        resetAfterCommand();
        show(buildPurchaseAlert(item.name, bought));
      });
    },
    [catalog, quantity.quantity, resetAfterCommand, selection, show],
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
  show: (input: AlertInput) => string,
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
        show(buildSaleAlert(item.name, sold));
      });
    },
    [catalog, onSold, quantity, selection, show],
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
