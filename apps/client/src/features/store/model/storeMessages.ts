import type { StoreClientErrorCode } from '~/shared/api';

const ERROR_MESSAGES: Record<StoreClientErrorCode, string> = {
  store_insufficient_gold: 'Você não tem gold coins suficientes.',
  store_internal_error: 'Não foi possível concluir a operação.',
  store_invalid_quantity: 'A quantidade precisa ser um número inteiro entre 1 e 999999.',
  store_item_not_in_backpack: 'Você não tem essa quantidade do item na mochila.',
  store_item_unavailable: 'O item não está à venda.',
  store_request_in_flight: 'A operação ainda está em andamento. Tente de novo em alguns instantes.',
  trainer_not_found: 'Treinador não encontrado.',
  unauthenticated: 'Sessão expirada. Entre de novo.',
  unknown: 'Não foi possível falar com o servidor.',
};

/**
 * The message of a refusal of the store.
 */
export function readStoreErrorMessage(code: StoreClientErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
}
