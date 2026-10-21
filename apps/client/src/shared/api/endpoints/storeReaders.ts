import type { ItemCategory } from '@creatures/contracts/inventory';
import type {
  StoreBagItem,
  StoreCatalog,
  StoreErrorCode,
  StoreItem,
  StorePurchase,
} from '@creatures/contracts/store';

const ITEM_CATEGORIES: readonly ItemCategory[] = ['consumable', 'device', 'material'];

/**
 * Every code the store answers with.
 *
 * The map is exhaustive by construction: adding a code to the contract without
 * adding it here breaks the build.
 */
export const STORE_ERROR_CODES: Record<StoreErrorCode, true> = {
  store_insufficient_gold: true,
  store_internal_error: true,
  store_invalid_quantity: true,
  store_item_not_in_backpack: true,
  store_item_unavailable: true,
  store_request_in_flight: true,
  trainer_not_found: true,
  unauthenticated: true,
};

export type StoreClientErrorCode = StoreErrorCode | 'unknown';

/**
 * What a command of the store answers with: the new wallet and the new backpack.
 *
 * A purchase and a sale answer with the same shape, and the two are the same
 * thing from the point of view of the screen that shows them.
 */
export type StoreOutcome = StorePurchase;

export function readCategory(value: unknown): ItemCategory {
  return ITEM_CATEGORIES.includes(value as ItemCategory) ? (value as ItemCategory) : 'material';
}

export function readItem(value: unknown): StoreItem | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const id = readString(entry.id);
  const name = readString(entry.name);
  const slug = readString(entry.slug);
  const description = readString(entry.description);
  const price = readNumber(entry, 'price');
  if (id === null || name === null || slug === null || description === null || price === null) {
    return null;
  }
  return {
    category: readCategory(entry.category),
    description,
    id,
    name,
    price,
    slug,
  };
}

export function readBagItem(value: unknown): StoreBagItem | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const itemId = readString(entry.itemId);
  const name = readString(entry.name);
  const slug = readString(entry.slug);
  const description = readString(entry.description);
  const quantity = readNumber(entry, 'quantity');
  const sellPrice = readNumber(entry, 'sellPrice');
  if (
    itemId === null ||
    name === null ||
    slug === null ||
    description === null ||
    quantity === null ||
    sellPrice === null
  ) {
    return null;
  }
  return {
    category: readCategory(entry.category),
    description,
    itemId,
    name,
    quantity,
    sellPrice,
    slug,
  };
}

/**
 * The code of a failed answer.
 *
 * The codes of the store live in their own namespace: the shared map of the
 * trainer knows nothing about them, so the body is the only source.
 */
export function readErrorCode(status: number, body: unknown): StoreClientErrorCode {
  const code = readBodyCode(body);
  if (code !== null) {
    return code;
  }
  if (status === 401) {
    return 'unauthenticated';
  }
  return 'unknown';
}

/**
 * The catalog of the store, with the backpack of the trainer and his gold.
 */
export function readCatalog(body: unknown): StoreCatalog | null {
  const entry = readRecord(body);
  if (entry === null) {
    return null;
  }
  const bag = readBag(entry.bag);
  const gold = readNumber(entry, 'gold');
  if (bag === null || gold === null) {
    return null;
  }
  return { bag, gold, items: readItems(entry.items) };
}

/**
 * The result of a command of the store.
 */
export function readOutcome(body: unknown): StoreOutcome | null {
  const entry = readRecord(body);
  if (entry === null) {
    return null;
  }
  const bag = readBag(entry.bag);
  const gold = readNumber(entry, 'gold');
  const total = readNumber(entry, 'total');
  if (bag === null || gold === null || total === null) {
    return null;
  }
  return { bag, gold, total };
}

export function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function readNumber(entry: Record<string, unknown>, field: string): number | null {
  const value = entry[field];
  return typeof value === 'number' ? value : null;
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readBodyCode(body: unknown): StoreClientErrorCode | null {
  const entry = readRecord(body);
  if (entry === null) {
    return null;
  }
  const error = entry.error;
  if (typeof error !== 'string') {
    return null;
  }
  return Object.hasOwn(STORE_ERROR_CODES, error) ? (error as StoreErrorCode) : null;
}

function readItems(value: unknown): StoreItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsed = value.map(readItem);
  return parsed.filter(isPresent);
}

function readBag(value: unknown): StoreBagItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const parsed = value.map(readBagItem);
  return parsed.filter(isPresent);
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
