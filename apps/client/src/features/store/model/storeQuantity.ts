import type { StoreBagItem, StoreItem } from '@creatures/contracts/store';

import type { StoreTab } from './store.types';

export const MAX_STORE_QUANTITY = 999999;
export const MIN_STORE_QUANTITY = 1;

/**
 * A quantity that is never zero and never above the limit.
 *
 * O limite e o que o jogador pode escolher: o dinheiro que ele tem, na
 * compra, e a quantidade que ele tem na mochila, na venda. Um limite zero
 * significa que o jogador nao pode comprar nem uma unidade.
 */
export function clampQuantity(value: number, limit = MAX_STORE_QUANTITY): number {
  const max = Math.min(limit, MAX_STORE_QUANTITY);
  if (value <= MIN_STORE_QUANTITY) {
    return Math.min(MIN_STORE_QUANTITY, max);
  }
  if (value > max) {
    return max;
  }
  return Math.trunc(value);
}

/**
 * The quantity the field shows when it loses the focus: one, when the field
 * is empty or holds something that is not a number.
 */
export function normalizeQuantity(text: string, limit = MAX_STORE_QUANTITY): number {
  const parsed = Math.trunc(Number(text));
  if (Number.isNaN(parsed)) {
    return Math.min(MIN_STORE_QUANTITY, Math.min(limit, MAX_STORE_QUANTITY));
  }
  return clampQuantity(parsed, limit);
}

/**
 * The quantity the field holds while the player writes it.
 *
 * The text is not a number yet: the field shows what the player typed, and the
 * quantity follows it — sempre dentro do limite.
 */
export function readQuantity(text: string, limit = MAX_STORE_QUANTITY): number {
  const parsed = Math.trunc(Number(text));
  if (Number.isNaN(parsed)) {
    return Math.min(MIN_STORE_QUANTITY, Math.min(limit, MAX_STORE_QUANTITY));
  }
  return clampQuantity(parsed, limit);
}

/**
 * The biggest quantity the player can choose.
 *
 * Na compra, o limite e o dinheiro: o jogador nao pode comprar mais do que
 * paga. Na venda, o limite e a mochila: o jogador nao pode vender o que nao
 * tem.
 */
export function computeQuantityLimit(
  tab: StoreTab,
  catalog: StoreItem[],
  bag: StoreBagItem[],
  selectedItemId: string | null,
  selectedBagItemId: string | null,
  gold: number,
): number {
  if (tab === 'sell') {
    const item = bag.find(function matches(entry: StoreBagItem): boolean {
      return entry.itemId === selectedBagItemId;
    });
    if (item === undefined) {
      return 0;
    }
    return clampQuantity(item.quantity);
  }
  const item = catalog.find(function matches(entry: StoreItem): boolean {
    return entry.id === selectedItemId;
  });
  if (item === undefined) {
    return 0;
  }
  if (item.price <= 0) {
    return MAX_STORE_QUANTITY;
  }
  // O limite nunca fica abaixo de uma unidade: a quantidade do campo nunca e
  // zero. Quando o jogador nao paga nem uma unidade, quem impede a compra e o
  // botao, que fica desabilitado com o motivo na tela.
  return Math.max(MIN_STORE_QUANTITY, Math.floor(gold / item.price));
}
