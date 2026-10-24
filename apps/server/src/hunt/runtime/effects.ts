import type { SupabaseClient } from '@supabase/supabase-js';

import { creditLoot, createCapturedCreature, spendItem } from '~/hunt/runtime/persistence';
import type { SimEvent } from '~/hunt/sim';

import { addCredited } from './runtime';
import type { HuntRuntime } from './types';

/**
 * Applies the side effects of the events of a window, in the order they
 * happened.
 *
 * Only loot and consumables touch the database; the other events are for the
 * connection and never become a write.
 */
export function applySideEffects(
  admin: SupabaseClient,
  runtime: HuntRuntime,
  events: SimEvent[],
): Promise<void> {
  let chain = Promise.resolve();
  for (const event of events) {
    chain = chain.then(buildEventStep(admin, runtime, event));
  }
  return chain;
}

/**
 * Credits what the ledger has and the backpack does not, at the close.
 *
 * The runtime keeps what was already written, so a loot credited at the moment
 * of the kill is not credited twice.
 */
export function creditRemaining(admin: SupabaseClient, runtime: HuntRuntime): Promise<void> {
  return creditDrops(admin, runtime).then(function afterDrops(): Promise<void> {
    return spendCredits(admin, runtime);
  });
}

function buildEventStep(
  admin: SupabaseClient,
  runtime: HuntRuntime,
  event: SimEvent,
): () => Promise<void> {
  return function applyEvent(): Promise<void> {
    if (event.type === 'loot') {
      return creditLoot(admin, runtime.trainerId, event.itemId, event.quantity).then(
        function credited(): void {
          addCredited(runtime.credited.drops, event.itemId, event.quantity);
        },
      );
    }
    if (event.type === 'consumable_used') {
      return spendItem(admin, runtime.trainerId, event.itemId, event.quantity).then(
        function spent(): void {
          addCredited(runtime.credited.spent, event.itemId, event.quantity);
        },
      );
    }
    if (event.type === 'capture') {
      return spendItem(admin, runtime.trainerId, event.deviceItemId, 1).then(
        function consumed(): Promise<void> | void {
          addCredited(runtime.credited.spent, event.deviceItemId, 1);
          if (!event.success || event.potential === undefined || event.creatureId === undefined) {
            return undefined;
          }
          return createCapturedCreature(
            admin,
            runtime.trainerId,
            event.speciesSlug,
            event.potential,
            event.teamSlot,
            event.creatureId,
          );
        },
      );
    }
    return Promise.resolve();
  };
}

function creditDrops(admin: SupabaseClient, runtime: HuntRuntime): Promise<void> {
  let chain = Promise.resolve();
  for (const drop of runtime.state.ledger.drops) {
    chain = chain.then(buildDropStep(admin, runtime, drop));
  }
  return chain;
}

function buildDropStep(
  admin: SupabaseClient,
  runtime: HuntRuntime,
  drop: { itemId: string; quantity: number },
): () => Promise<void> {
  return function creditDrop(): Promise<void> {
    const credited = runtime.credited.drops[drop.itemId] ?? 0;
    if (drop.quantity <= credited) {
      return Promise.resolve();
    }
    return creditLoot(admin, runtime.trainerId, drop.itemId, drop.quantity - credited).then(
      function markDrop(): void {
        runtime.credited.drops[drop.itemId] = drop.quantity;
      },
    );
  };
}

function spendCredits(admin: SupabaseClient, runtime: HuntRuntime): Promise<void> {
  let chain = Promise.resolve();
  for (const spent of runtime.state.ledger.spent) {
    chain = chain.then(buildSpentStep(admin, runtime, spent));
  }
  return chain;
}

function buildSpentStep(
  admin: SupabaseClient,
  runtime: HuntRuntime,
  spent: { itemId: string; quantity: number },
): () => Promise<void> {
  return function spendCredit(): Promise<void> {
    const credited = runtime.credited.spent[spent.itemId] ?? 0;
    if (spent.quantity <= credited) {
      return Promise.resolve();
    }
    return spendItem(admin, runtime.trainerId, spent.itemId, spent.quantity - credited).then(
      function markSpent(): void {
        runtime.credited.spent[spent.itemId] = spent.quantity;
      },
    );
  };
}
