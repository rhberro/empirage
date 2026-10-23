import { useCallback, useState } from 'react';

import {
  clampQuantity,
  normalizeQuantity,
  readQuantity,
  MIN_STORE_QUANTITY,
} from './storeQuantity';

export type StoreQuantityView = {
  /** Normalizes the quantity when the field loses the focus. */
  commitQuantity: () => void;
  /** The quantity the player is buying. */
  quantity: number;
  /** The text of the quantity field, while the player writes it. */
  quantityText: string;
  /** Puts the quantity back to its first value. */
  reset: () => void;
  /** Puts the quantity in the limit: o maior numero que o jogador pode. */
  setMaxQuantity: () => void;
  /** Adds a step to the quantity. */
  stepQuantity: (step: number) => void;
  /** Writes in the quantity field. */
  typeQuantity: (text: string) => void;
};

const INITIAL_QUANTITY = 1;

type StoredQuantity = {
  limit: number;
  quantity: number;
  quantityText: string;
};

type QuantityState = {
  commitQuantity: () => void;
  quantity: number;
  quantityText: string;
  reset: () => void;
  setMaxQuantity: () => void;
  stepQuantity: (step: number) => void;
  typeQuantity: (text: string) => void;
};

/**
 * The quantity of the store modal.
 *
 * The quantity is never zero: a field that is empty or that holds a negative
 * number goes back to one when it loses the focus. E nunca passa do limite:
 * o dinheiro que o jogador tem, na compra, e a quantidade que ele tem na
 * mochila, na venda.
 */
export function useStoreQuantity(limit: number): StoreQuantityView {
  const state = useQuantityState(limit);
  return {
    commitQuantity: state.commitQuantity,
    quantity: state.quantity,
    quantityText: state.quantityText,
    reset: state.reset,
    setMaxQuantity: state.setMaxQuantity,
    stepQuantity: state.stepQuantity,
    typeQuantity: state.typeQuantity,
  };
}

function useQuantityState(limit: number): QuantityState {
  // A quantidade nunca e zero: um limite zero e o caso de "nada selecionado",
  // e o campo fica desabilitado com o valor 1.
  const max = Math.max(MIN_STORE_QUANTITY, limit);
  const [stored, setStored] = useState<StoredQuantity>(function initial(): StoredQuantity {
    return buildStored(max, INITIAL_QUANTITY, String(INITIAL_QUANTITY));
  });
  const current = resolveStored(stored, max);
  const actions = useQuantityActions(current, max, setStored);
  return {
    commitQuantity: actions.commitQuantity,
    quantity: current.quantity,
    quantityText: current.quantityText,
    reset: actions.reset,
    setMaxQuantity: actions.setMaxQuantity,
    stepQuantity: actions.stepQuantity,
    typeQuantity: actions.typeQuantity,
  };
}

type QuantityActions = Omit<QuantityState, 'quantity' | 'quantityText'>;

function useQuantityActions(
  current: StoredQuantity,
  limit: number,
  setStored: (stored: StoredQuantity) => void,
): QuantityActions {
  const reset = useCallback(
    function resetQuantity(): void {
      setStored(buildStored(limit, INITIAL_QUANTITY, String(INITIAL_QUANTITY)));
    },
    [limit, setStored],
  );

  const typeQuantity = useCallback(
    function typeQuantityText(text: string): void {
      setStored(buildStored(limit, readQuantity(text, limit), clampText(text, limit)));
    },
    [limit, setStored],
  );

  const commitQuantity = useCallback(
    function commitQuantityText(): void {
      const normalized = normalizeQuantity(current.quantityText, limit);
      setStored(buildStored(limit, normalized, String(normalized)));
    },
    [current.quantityText, limit, setStored],
  );

  const stepQuantity = useCallback(
    function addStep(step: number): void {
      const next = clampQuantity(current.quantity + step, limit);
      setStored(buildStored(limit, next, String(next)));
    },
    [current.quantity, limit, setStored],
  );

  const setMaxQuantity = useCallback(
    function selectMaxQuantity(): void {
      const next = clampQuantity(limit, limit);
      setStored(buildStored(limit, next, String(next)));
    },
    [limit, setStored],
  );

  return { commitQuantity, reset, setMaxQuantity, stepQuantity, typeQuantity };
}

/**
 * The stored quantity, brought back inside the limit when the limit changed.
 *
 * O limite muda quando o jogador escolhe outro item, e quando o dinheiro ou a
 * mochila mudam depois de uma compra ou de uma venda. A quantidade que ficou
 * grande demais volta para dentro do limite — e o texto vai com ela.
 */
function resolveStored(stored: StoredQuantity, limit: number): StoredQuantity {
  if (stored.limit === limit) {
    return stored;
  }
  const quantity = clampQuantity(stored.quantity, limit);
  return buildStored(limit, quantity, String(quantity));
}

/**
 * The text of the campo, dentro do limite.
 *
 * O jogador nunca ve no campo uma quantidade que ele nao pode comprar: o
 * texto que passa do limite vira o limite. O zero e o negativo ficam como
 * estão — quem corrige o zero e o negativo e a saida do foco.
 */
function clampText(text: string, limit: number): string {
  const parsed = Math.trunc(Number(text));
  if (!Number.isFinite(parsed) || parsed <= limit) {
    return text;
  }
  return String(limit);
}

function buildStored(limit: number, quantity: number, quantityText: string): StoredQuantity {
  return { limit, quantity, quantityText };
}
