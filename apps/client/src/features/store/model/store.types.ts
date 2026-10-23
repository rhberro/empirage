import type { StoreBagItem, StoreItem } from '@creatures/contracts/store';

export type StoreTab = 'buy' | 'sell';

export type StoreView = {
  /** The items of the backpack, grouped, as the sell tab shows them. */
  bag: StoreBagItem[];
  /** Buys the selected item. */
  buy: () => void;
  /** The items the store sells. */
  catalog: StoreItem[];
  /** Takes the selection away. */
  clearSelection: () => void;
  /** Closes the modal and resets everything. */
  close: () => void;
  /** Normalizes the quantity when the field loses the focus. */
  commitQuantity: () => void;
  /** The message of the last refusal of the server. */
  error: string | null;
  /** The gold the trainer has. */
  gold: number;
  /** The command is running: the button waits for the server. */
  isBusy: boolean;
  /** The catalog is loading. */
  isLoading: boolean;
  /** The quantity the player is buying. */
  quantity: number;
  /** The biggest quantity the player can choose. */
  quantityLimit: number;
  /** The text of the quantity field, while the player writes it. */
  quantityText: string;
  /** The item of the backpack the player selected to sell. */
  selectedBagItemId: string | null;
  /** The item of the catalog the player selected to buy. */
  selectedItemId: string | null;
  /** Sells the selected item of the backpack. */
  sell: () => void;
  /** Selects an item of the current tab. */
  select: (itemId: string) => void;
  /** Puts the quantity in the limit. */
  setMaxQuantity: () => void;
  /** Changes the tab and resets the state of the modal. */
  setTab: (tab: StoreTab) => void;
  /** Adds a step to the quantity. */
  stepQuantity: (step: number) => void;
  /** The tab the modal is showing. */
  tab: StoreTab;
  /** The gold the action of the current tab costs, or yields. */
  total: number;
  /** Writes in the quantity field. */
  typeQuantity: (text: string) => void;
};
