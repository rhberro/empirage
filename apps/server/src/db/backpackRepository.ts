import type { SupabaseClient } from '@supabase/supabase-js';

import type { DatabaseError } from '~/db/types';

export type DestroyItemOutcome =
  | { status: 'destroyed' }
  | { status: 'equipped' }
  | { status: 'not_in_backpack' }
  | { error: DatabaseError; status: 'failed' };

type QueryResult<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type QuantityRow = {
  quantity: number;
};

type ItemRow = {
  item_id: string;
};

type QuantityLookup = {
  error: DatabaseError | null;
  quantity: number | null;
};

type EquippedLookup = {
  error: DatabaseError | null;
  equipped: boolean;
};

/**
 * Destroys every unit of an item of the backpack.
 *
 * The item has to be owned, and it cannot be equipped: an item of the skill bar
 * that leaves the backpack for good would leave the slot pointing at nothing.
 * There is no stack split: destroying removes the whole stack at once.
 */
export function destroyBackpackItem(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
): Promise<DestroyItemOutcome> {
  return findBackpackQuantity(admin, trainerId, itemId).then(function withQuantity(
    lookup: QuantityLookup,
  ): DestroyItemOutcome | Promise<DestroyItemOutcome> {
    if (lookup.error !== null) {
      return { error: lookup.error, status: 'failed' };
    }
    if (lookup.quantity === null || lookup.quantity < 1) {
      return { status: 'not_in_backpack' };
    }
    return isItemEquipped(admin, trainerId, itemId).then(function withEquipped(
      equipped: EquippedLookup,
    ): DestroyItemOutcome | Promise<DestroyItemOutcome> {
      if (equipped.error !== null) {
        return { error: equipped.error, status: 'failed' };
      }
      if (equipped.equipped) {
        return { status: 'equipped' };
      }
      return removeAllUnits(admin, trainerId, itemId);
    });
  });
}

/**
 * How many units of the item the trainer owns, or null when he owns none.
 */
export function findBackpackQuantity(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
): Promise<QuantityLookup> {
  const query = admin
    .from('trainer_items')
    .select('quantity')
    .eq('trainer_id', trainerId)
    .eq('item_id', itemId)
    .maybeSingle();
  return Promise.resolve(query.then(readQuantityLookup));
}

/**
 * Whether the item is in one of the slots of the skill bar of the trainer.
 */
export function isItemEquipped(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
): Promise<EquippedLookup> {
  const query = admin
    .from('trainer_gear_slots')
    .select('item_id')
    .eq('trainer_id', trainerId)
    .eq('item_id', itemId)
    .limit(1);
  return Promise.resolve(query.then(readEquippedLookup));
}

/**
 * Removes the whole stack of the item from the backpack.
 *
 * The delete only matches the row that was read: a command that runs while
 * another one changed the same stack does not leave a stale row behind.
 */
export function removeAllUnits(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
): Promise<DestroyItemOutcome> {
  const query = admin
    .from('trainer_items')
    .delete()
    .eq('trainer_id', trainerId)
    .eq('item_id', itemId)
    .select('item_id');
  return Promise.resolve(query.then(readRemovalOutcome));
}

function readQuantityLookup(result: QueryResult<QuantityRow>): QuantityLookup {
  if (result.error !== null) {
    return { error: readError(result.error), quantity: null };
  }
  if (result.data === null) {
    return { error: null, quantity: null };
  }
  return { error: null, quantity: result.data.quantity };
}

function readEquippedLookup(result: QueryResult<ItemRow[]>): EquippedLookup {
  if (result.error !== null) {
    return { equipped: false, error: readError(result.error) };
  }
  const rows = result.data ?? [];
  return { equipped: rows.length > 0, error: null };
}

function readRemovalOutcome(result: QueryResult<QuantityRow[]>): DestroyItemOutcome {
  if (result.error !== null) {
    return { error: readError(result.error), status: 'failed' };
  }
  const rows = result.data ?? [];
  if (rows.length === 0) {
    return { status: 'not_in_backpack' };
  }
  return { status: 'destroyed' };
}

function readError(error: { code: string; message: string }): DatabaseError {
  return { code: error.code, message: error.message };
}
