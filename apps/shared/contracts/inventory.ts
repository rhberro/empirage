/**
 * The category of an item, which decides the quick filter it shows under.
 *
 * The material category is the leftover: creature parts and anything that is
 * neither a consumable nor a capture device.
 */
export type ItemCategory = 'consumable' | 'device' | 'material';

/**
 * The command of the backpack that destroys one unit of an item.
 */
export type DestroyItemInput = {
  itemId: string;
};

/**
 * The reasons the backpack refuses to destroy an item.
 *
 * The codes live in the namespace of the backpack: the shared trainer contract
 * has a closed set of codes, and destroying an item is not a trainer rule.
 */
export type DestroyItemErrorCode =
  | 'destroy_item_equipped'
  | 'destroy_item_internal_error'
  | 'destroy_item_invalid_item'
  | 'destroy_item_not_in_backpack'
  // The same request is still running.
  //
  // The client sends an idempotency key, and the server refuses a second request
  // with the same key while the first one has not answered yet. The refusal is
  // not a failure of the operation: the operation is happening, and the client
  // is expected to ask again with the same key.
  | 'destroy_item_request_in_flight'
  | 'trainer_not_found'
  | 'unauthenticated';

/**
 * An item the trainer owns, with how many of it there are.
 */
export type InventoryItem = {
  category: ItemCategory;
  description: string;
  itemId: string;
  /**
   * Whether the item is one of the items the store of the NPC sells.
   *
   * A drop is not: ele se vende na loja, mas a loja nao o oferece. O preco do
   * item so aparece na interface quando o item e da loja.
   */
  isStoreItem: boolean;
  name: string;
  /** The price of the item in the store of the NPC. */
  price: number;
  quantity: number;
  slug: string;
};
