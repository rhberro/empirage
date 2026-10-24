import type { Potential } from '@creatures/contracts/creature';
import type { HuntEndReason } from '@creatures/contracts/huntSession';
import type { SupabaseClient } from '@supabase/supabase-js';

import { finishHuntSession } from '~/hunt/session';
import type { SimState, SimTeamMember } from '~/hunt/sim';

/**
 * The writes of the hunt in the database.
 *
 * The runtime is the only writer of a hunt: the simulation never writes on a
 * damage event, and the checkpoint aggregates what happened since the previous
 * one.
 */

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type StartedAtRow = {
  started_at: string;
};

type QuantityRow = {
  quantity: number;
};

/**
 * Writes the checkpoint of a session, with the cursor and the accumulated
 * counters.
 *
 * The stamina spent is derived from the start of the session, which the caller
 * knows; when it does not, the row is read to keep the accounting exact.
 */
export function saveHuntSimulation(
  admin: SupabaseClient,
  sessionId: string,
  state: SimState,
  startedAt?: number,
): Promise<void> {
  return readStaminaSpent(admin, sessionId, state, startedAt).then(function write(
    staminaSpentMinutes: number,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      encounters: state.ledger.encounters,
      kills: state.ledger.kills,
      last_simulated_at: new Date(state.simulatedAt).toISOString(),
      rng_draws: state.rng.draws,
      rng_seed: state.rng.seed,
      simulation_state: state,
      stamina_spent_minutes: staminaSpentMinutes,
    };
    const query = admin.from('hunt_sessions').update(patch).eq('id', sessionId);
    return ensureNoError(query);
  });
}

/**
 * The persisted state of a session, when the session has one.
 */
export function readHuntSimulation(
  admin: SupabaseClient,
  sessionId: string,
): Promise<SimState | null> {
  const query = admin
    .from('hunt_sessions')
    .select('simulation_state')
    .eq('id', sessionId)
    .maybeSingle();
  return Promise.resolve(query).then(function toState(
    result: QueryResult<{ simulation_state: unknown }>,
  ): SimState | null {
    ensureResult(result);
    const stored = result.data?.simulation_state;
    return stored === null || stored === undefined ? null : (stored as SimState);
  });
}

/**
 * Writes the life and the experience of every member of the team.
 */
export function saveTeamState(admin: SupabaseClient, team: SimTeamMember[]): Promise<void> {
  return Promise.all(team.map(buildTeamWrite(admin))).then(function done(): void {
    return undefined;
  });
}

/**
 * Adds units of an item to the backpack of the trainer.
 *
 * The runtime is the only writer of the item while the hunt runs, so a read
 * followed by a write cannot lose a unit of another source.
 */
export function creditLoot(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    return Promise.resolve();
  }
  return readItemQuantity(admin, trainerId, itemId).then(function write(
    current: number | null,
  ): Promise<void> {
    if (current === null) {
      const row = { item_id: itemId, quantity, trainer_id: trainerId };
      return ensureNoError(admin.from('trainer_items').insert(row));
    }
    return writeItemQuantity(admin, trainerId, itemId, current + quantity);
  });
}

/**
 * Removes units of an item from the backpack of the trainer.
 *
 * A stack that reaches zero is deleted: an item with no unit is not an item the
 * trainer has, and every reader of the backpack already filters the zeros.
 */
export function spendItem(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    return Promise.resolve();
  }
  return readItemQuantity(admin, trainerId, itemId).then(function write(
    current: number | null,
  ): Promise<void> | void {
    if (current === null) {
      return undefined;
    }
    const remaining = Math.max(0, current - quantity);
    if (remaining === 0) {
      const query = admin
        .from('trainer_items')
        .delete()
        .eq('trainer_id', trainerId)
        .eq('item_id', itemId);
      return ensureNoError(query);
    }
    return writeItemQuantity(admin, trainerId, itemId, remaining);
  });
}

/**
 * Writes the stamina that is left for the trainer when the hunt closes.
 */
export function debitStamina(
  admin: SupabaseClient,
  trainerId: string,
  remainingMinutes: number,
): Promise<void> {
  const patch = { stamina_minutes: Math.max(0, Math.floor(remainingMinutes)) };
  const query = admin.from('trainers').update(patch).eq('id', trainerId);
  return ensureNoError(query);
}

/**
 * Restores the life of every creature of the trainer.
 *
 * A null life is a full life in the domain: the city and the next hunt both
 * read the creature as healed, whichever way the hunt ended.
 */
export function healTrainerCreatures(admin: SupabaseClient, trainerId: string): Promise<void> {
  const query = admin.from('creatures').update({ current_hp: null }).eq('trainer_id', trainerId);
  return ensureNoError(query);
}

/**
 * Closes the session in soft-close, keeping the reason and the moment.
 */
export function finishSession(
  admin: SupabaseClient,
  sessionId: string,
  reason: HuntEndReason,
  endedAt: number,
): Promise<void> {
  return finishHuntSession(admin, sessionId, reason, endedAt).then(function done(): void {
    return undefined;
  });
}

function buildTeamWrite(admin: SupabaseClient): (member: SimTeamMember) => Promise<void> {
  return function writeMember(member: SimTeamMember): Promise<void> {
    const patch = { current_hp: member.hp, experience: member.experience, level: member.level };
    const query = admin.from('creatures').update(patch).eq('id', member.creatureId);
    return ensureNoError(query);
  };
}

/** Inserts a captured creature: level one, no experience, the rolled potential. */
export function createCapturedCreature(
  admin: SupabaseClient,
  trainerId: string,
  speciesSlug: string,
  potential: Potential,
  teamSlot: number | undefined,
  creatureId: string,
): Promise<void> {
  return readSpeciesIdBySlug(admin, speciesSlug).then(function insert(speciesId: string | null) {
    if (speciesId === null) {
      throw new Error(`Captured species ${speciesSlug} was not found`);
    }
    const row = {
      experience: 0,
      id: creatureId,
      is_in_team: teamSlot !== undefined,
      level: 1,
      potential,
      species_id: speciesId,
      team_slot: teamSlot ?? null,
      trainer_id: trainerId,
    };
    return ensureNoError(admin.from('creatures').insert(row));
  });
}

function writeItemQuantity(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const query = admin
    .from('trainer_items')
    .update({ quantity })
    .eq('trainer_id', trainerId)
    .eq('item_id', itemId);
  return ensureNoError(query);
}

function readStaminaSpent(
  admin: SupabaseClient,
  sessionId: string,
  state: SimState,
  startedAt?: number,
): Promise<number> {
  if (startedAt !== undefined) {
    return Promise.resolve(readMinutes(state.simulatedAt - startedAt));
  }
  const query = admin.from('hunt_sessions').select('started_at').eq('id', sessionId).maybeSingle();
  return Promise.resolve(query).then(function withRow(result: QueryResult<StartedAtRow>): number {
    ensureResult(result);
    if (result.data === null) {
      return 0;
    }
    return readMinutes(state.simulatedAt - new Date(result.data.started_at).getTime());
  });
}

type SpeciesRow = {
  id: string;
};

function readSpeciesIdBySlug(admin: SupabaseClient, slug: string): Promise<string | null> {
  const query = admin.from('species').select('id').eq('slug', slug).maybeSingle();
  return Promise.resolve(query).then(function toId(result: QueryResult<SpeciesRow>): string | null {
    ensureResult(result);
    return result.data === null ? null : result.data.id;
  });
}

function readItemQuantity(
  admin: SupabaseClient,
  trainerId: string,
  itemId: string,
): Promise<number | null> {
  const query = admin
    .from('trainer_items')
    .select('quantity')
    .eq('trainer_id', trainerId)
    .eq('item_id', itemId)
    .maybeSingle();
  return Promise.resolve(query).then(function toQuantity(
    result: QueryResult<QuantityRow>,
  ): number | null {
    ensureResult(result);
    return result.data === null ? null : result.data.quantity;
  });
}

function readMinutes(elapsed: number): number {
  return Math.max(0, Math.floor(elapsed / 60_000));
}

function ensureResult<T>(result: QueryResult<T>): void {
  if (result.error !== null) {
    throw new Error(`Hunt persistence failed: ${result.error.message}`);
  }
}

function ensureNoError(query: PromiseLike<unknown>): Promise<void> {
  return Promise.resolve(query).then(function check(value: unknown): void {
    ensureResult(value as QueryResult<unknown>);
  });
}
