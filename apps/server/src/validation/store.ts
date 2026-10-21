import type { StoreErrorCode } from '@creatures/contracts/store';

import { isUuid } from '~/validation/trainer';

export type StoreCommand = {
  itemId: string;
  quantity: number;
};

export type StoreCommandValidation =
  | { ok: true; value: StoreCommand }
  | { code: StoreErrorCode; message: string; ok: false };

export const MAX_STORE_QUANTITY = 999999;

const INVALID_QUANTITY: StoreErrorCode = 'store_invalid_quantity';
const UNAVAILABLE_ITEM: StoreErrorCode = 'store_item_unavailable';

const ERROR_MESSAGES: Record<StoreErrorCode, string> = {
  store_insufficient_gold: 'Você não tem gold coins suficientes.',
  store_internal_error: 'Erro interno do servidor.',
  store_invalid_quantity: 'A quantidade precisa ser um número inteiro entre 1 e 999999.',
  store_item_not_in_backpack: 'O item não está na mochila.',
  store_item_unavailable: 'O item não está à venda.',
  store_request_in_flight:
    'Esta operação já está em andamento. Tente novamente em alguns instantes.',
  trainer_not_found: 'Treinador não encontrado.',
  unauthenticated: 'Token inválido ou ausente.',
};

/**
 * The command of the store: the item and how many of it.
 *
 * The quantity is a whole number of items: there is no half potion, and the
 * limit keeps the arithmetic of the wallet inside the range of a number.
 */
export function validateStoreCommand(body: unknown): StoreCommandValidation {
  if (!isRecord(body)) {
    return invalidQuantity();
  }
  const itemId = body.itemId;
  if (typeof itemId !== 'string' || !isUuid(itemId)) {
    return unavailableItem();
  }
  const quantity = body.quantity;
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_STORE_QUANTITY
  ) {
    return invalidQuantity();
  }
  return { ok: true, value: { itemId, quantity } };
}

export function readStoreErrorMessage(code: StoreErrorCode): string {
  return ERROR_MESSAGES[code];
}

function invalidQuantity(): StoreCommandValidation {
  return { code: INVALID_QUANTITY, message: readStoreErrorMessage(INVALID_QUANTITY), ok: false };
}

function unavailableItem(): StoreCommandValidation {
  return { code: UNAVAILABLE_ITEM, message: readStoreErrorMessage(UNAVAILABLE_ITEM), ok: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
