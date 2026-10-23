import type { DestroyItemErrorCode, DestroyItemInput } from '@creatures/contracts/inventory';

import { isUuid } from '~/validation/trainer';

export type DestroyItemValidation =
  | { ok: true; value: DestroyItemInput }
  | { code: DestroyItemErrorCode; message: string; ok: false };

const INVALID_ITEM: DestroyItemErrorCode = 'destroy_item_invalid_item';

const ERROR_MESSAGES: Record<DestroyItemErrorCode, string> = {
  destroy_item_equipped: 'O item está equipado e não pode ser destruído.',
  destroy_item_internal_error: 'Erro interno do servidor.',
  destroy_item_invalid_item: 'Identificador de item inválido.',
  destroy_item_not_in_backpack: 'O item não está na mochila.',
  destroy_item_request_in_flight:
    'Esta operação já está em andamento. Tente novamente em alguns instantes.',
  trainer_not_found: 'Treinador não encontrado.',
  unauthenticated: 'Token inválido ou ausente.',
};

/**
 * The command of the backpack: the item that loses one unit.
 */
export function validateDestroyItemCommand(body: unknown): DestroyItemValidation {
  if (!isRecord(body)) {
    return invalidItem();
  }
  const itemId = body.itemId;
  if (typeof itemId !== 'string' || !isUuid(itemId)) {
    return invalidItem();
  }
  return { ok: true, value: { itemId } };
}

export function readDestroyItemErrorMessage(code: DestroyItemErrorCode): string {
  return ERROR_MESSAGES[code];
}

function invalidItem(): DestroyItemValidation {
  return { code: INVALID_ITEM, message: readDestroyItemErrorMessage(INVALID_ITEM), ok: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
