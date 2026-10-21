/**
 * The key of the intent of the player in the store.
 *
 * The key says which purchase the request is: the server knows the key, keeps
 * the result of the purchase, and answers with it instead of charging the
 * player twice.
 *
 * The key is born with the intent and dies with it — a new purchase is a new
 * key. The exception is the purchase the server is still running: that one
 * keeps its key, so the attempt that comes after is the same purchase and not
 * a second charge.
 */
export type StoreIntent = {
  /** The key of the purchase the player is making now. */
  begin(): string;
  /** The answer of the server: the purchase ended, or it is still running. */
  settle(outcome: StoreIntentOutcome): void;
};

/**
 * How the purchase of an intent ended.
 */
export type StoreIntentOutcome = 'ended' | 'in_flight';

/**
 * The intent of the player in the store.
 *
 * The store runs one command at a time, so the intent has a single key at
 * any moment.
 */
export function createStoreIntent(): StoreIntent {
  let key: string | null = null;
  let running = false;
  return {
    begin(): string {
      // A purchase the server is still running is the same purchase: the key
      // of the intent that did not end survives, so the attempt that comes
      // after is not a second charge. A purchase that ended is a new one, and
      // a new one gets a new key.
      if (key === null || running) {
        key = createIntentKey();
      }
      running = true;
      return key;
    },
    settle(outcome: StoreIntentOutcome): void {
      running = false;
      if (outcome === 'ended') {
        key = null;
      }
    },
  };
}

/**
 * The key of a purchase.
 */
function createIntentKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
