import type { SupabaseClient } from '@supabase/supabase-js';

import type { DatabaseError } from '~/db/types';

const RELEASE_CREATURE_FUNCTION = 'release_creature';

export type CreatureOperationOutcome = {
  error: DatabaseError | null;
  released: boolean;
};

type QueryResult<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

/**
 * Releases a creature: it leaves the storage of the trainer for good.
 *
 * A criatura do time nao e solta: ela sai do time primeiro, e so depois a
 * liberacao acontece. A decisao e do banco, e nao do cliente.
 */
export function releaseCreature(
  admin: SupabaseClient,
  trainerId: string,
  ownerId: string,
  creatureId: string,
): Promise<CreatureOperationOutcome> {
  const args = { p_creature_id: creatureId, p_owner_id: ownerId, p_trainer_id: trainerId };
  return Promise.resolve(admin.rpc(RELEASE_CREATURE_FUNCTION, args).then(readOutcome));
}

function readOutcome(result: QueryResult<boolean>): CreatureOperationOutcome {
  if (result.error !== null) {
    return { error: { code: result.error.code, message: result.error.message }, released: false };
  }
  return { error: null, released: result.data === true };
}
