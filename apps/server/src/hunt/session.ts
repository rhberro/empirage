import type { HuntAction, HuntEndReason, HuntSession } from '@creatures/contracts/huntSession';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The repository of the hunt sessions.
 *
 * The row of a session is a checkpoint and not a work queue: the server keeps
 * the simulation alive in memory and writes the row every now and then. The
 * row is closed in soft-close and never deleted, because the reason of the
 * end, the loot and the accounting of the offline session are all read from
 * it after the hunt is over.
 */

const HUNT_SESSION_COLUMNS =
  'id, account_id, trainer_id, hunt_area_id, status, started_at, last_simulated_at, ended_at, end_reason, rng_seed, rng_draws, encounters, kills, stamina_spent_minutes, stamina_at_start, actions';

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

/**
 * The shape of the row of a hunt session.
 */
type HuntSessionRow = {
  account_id: string;
  actions: HuntAction[] | null;
  end_reason: HuntEndReason | null;
  ended_at: string | null;
  encounters: number;
  hunt_area_id: string;
  id: string;
  kills: number;
  last_simulated_at: string;
  rng_draws: number;
  rng_seed: number;
  stamina_at_start: number;
  started_at: string;
  status: 'active' | 'finished';
  stamina_spent_minutes: number;
  trainer_id: string;
};

/**
 * The data of a hunt that is beginning.
 */
export type StartHuntSessionInput = {
  /** The account that owns the hunt. */
  accountId: string;
  /** The area being hunted. */
  huntAreaId: string;
  /** The seed of the random state of the hunt. */
  rngSeed: number;
  /**
   * The stamina of the trainer when the hunt began, in minutes.
   *
   * The value is captured once, here, and it travels with the session: the
   * instant the hunt ends by stamina depends on it.
   */
  staminaAtStart: number;
  /** The moment the hunt starts. */
  startedAt: number;
  /** The trainer that is hunting. */
  trainerId: string;
};

/**
 * Starts a hunt session.
 */
export function startHuntSession(
  admin: SupabaseClient,
  input: StartHuntSessionInput,
): Promise<HuntSession> {
  const startedAt = new Date(input.startedAt).toISOString();
  const row = {
    account_id: input.accountId,
    actions: [],
    hunt_area_id: input.huntAreaId,
    last_simulated_at: startedAt,
    rng_seed: input.rngSeed,
    stamina_at_start: input.staminaAtStart,
    started_at: startedAt,
    status: 'active',
    trainer_id: input.trainerId,
  };
  const query = admin.from('hunt_sessions').insert(row).select(HUNT_SESSION_COLUMNS).single();
  return Promise.resolve(query).then(readSession);
}

/**
 * The hunt session that is open for a trainer, when there is one.
 */
export function readActiveHuntSession(
  admin: SupabaseClient,
  trainerId: string,
): Promise<HuntSession | null> {
  const query = admin
    .from('hunt_sessions')
    .select(HUNT_SESSION_COLUMNS)
    .eq('trainer_id', trainerId)
    .eq('status', 'active')
    .maybeSingle();
  return Promise.resolve(query).then(readOptionalSession);
}

/**
 * The hunt session of an identifier, whatever its status is.
 */
export function readHuntSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<HuntSession | null> {
  const query = admin
    .from('hunt_sessions')
    .select(HUNT_SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();
  return Promise.resolve(query).then(readOptionalSession);
}

/**
 * The hunt sessions that are open and whose cursor is behind the given moment.
 *
 * This is the sweep of the boot: the server resumes every hunt that was left
 * open by the catch-up.
 */
export function listActiveHuntSessionsBehind(
  admin: SupabaseClient,
  now: number,
): Promise<HuntSession[]> {
  const query = admin
    .from('hunt_sessions')
    .select(HUNT_SESSION_COLUMNS)
    .eq('status', 'active')
    .lt('last_simulated_at', new Date(now).toISOString())
    .order('last_simulated_at', { ascending: true });
  return Promise.resolve(query).then(readSessionList);
}

/**
 * Writes the cursor and the accumulators of a session.
 *
 * The random state travels with the cursor: the catch-up of the hunt has to
 * draw from the same place where the simulation stopped.
 */
export function saveHuntCursor(admin: SupabaseClient, session: HuntSession): Promise<HuntSession> {
  const patch = {
    actions: session.actions,
    encounters: session.encounters,
    kills: session.kills,
    last_simulated_at: new Date(session.lastSimulatedAt).toISOString(),
    rng_draws: session.rngDraws,
    rng_seed: session.rngSeed,
    stamina_at_start: session.staminaAtStart,
    stamina_spent_minutes: session.staminaSpentMinutes,
  };
  const query = admin
    .from('hunt_sessions')
    .update(patch)
    .eq('id', session.id)
    .select(HUNT_SESSION_COLUMNS)
    .maybeSingle();
  return Promise.resolve(query).then(readSession);
}

/**
 * Writes an action of the player in the timeline of the session.
 *
 * The timeline is read and written as a whole: the queue of the commands of an
 * account is serial, so the read and the write of the timeline never overlap.
 */
export function appendHuntAction(
  admin: SupabaseClient,
  sessionId: string,
  action: HuntAction,
): Promise<HuntSession> {
  const query = admin
    .from('hunt_sessions')
    .select(HUNT_SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();
  return Promise.resolve(query)
    .then(readOptionalSession)
    .then(function withAction(session: HuntSession | null): Promise<HuntSession> {
      if (session === null) {
        throw new Error('Hunt session not found for the action');
      }
      const actions = [...session.actions, action].toSorted(byMoment);
      return saveHuntCursor(admin, { ...session, actions });
    });
}

/**
 * Closes a hunt session in soft-close.
 *
 * The row is never deleted: the reason of the end, the loot and the
 * accounting of the offline session are read from it after the hunt is over.
 */
export function finishHuntSession(
  admin: SupabaseClient,
  sessionId: string,
  endReason: HuntEndReason,
  endedAt: number,
): Promise<HuntSession> {
  const patch = {
    end_reason: endReason,
    ended_at: new Date(endedAt).toISOString(),
    status: 'finished',
  };
  const query = admin
    .from('hunt_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select(HUNT_SESSION_COLUMNS)
    .maybeSingle();
  return Promise.resolve(query).then(readSession);
}

/**
 * Orders the actions of a session by the moment they happened.
 */
function byMoment(first: HuntAction, second: HuntAction): number {
  return first.at - second.at;
}

/**
 * Reads the session of a query that returns one row.
 */
function readSession(result: QueryResult<HuntSessionRow>): HuntSession {
  if (result.error !== null) {
    throw new Error(`Hunt session write failed: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error('Hunt session write failed: no row returned');
  }
  return mapSession(result.data);
}

/**
 * Reads the session of a query that returns one row or none.
 */
function readOptionalSession(result: QueryResult<HuntSessionRow>): HuntSession | null {
  if (result.error !== null) {
    throw new Error(`Hunt session lookup failed: ${result.error.message}`);
  }
  return result.data === null ? null : mapSession(result.data);
}

/**
 * Reads the sessions of a query that returns a list.
 */
function readSessionList(result: QueryResult<HuntSessionRow[]>): HuntSession[] {
  if (result.error !== null) {
    throw new Error(`Hunt session lookup failed: ${result.error.message}`);
  }
  return (result.data ?? []).map(mapSession);
}

/**
 * Maps the row of a session to the session of the contract.
 */
function mapSession(row: HuntSessionRow): HuntSession {
  return {
    accountId: row.account_id,
    actions: row.actions ?? [],
    encounters: row.encounters,
    endReason: row.end_reason,
    endedAt: row.ended_at === null ? null : new Date(row.ended_at).getTime(),
    huntAreaId: row.hunt_area_id,
    id: row.id,
    kills: row.kills,
    lastSimulatedAt: new Date(row.last_simulated_at).getTime(),
    rngDraws: row.rng_draws,
    rngSeed: row.rng_seed,
    staminaAtStart: row.stamina_at_start,
    staminaSpentMinutes: row.stamina_spent_minutes,
    startedAt: new Date(row.started_at).getTime(),
    status: row.status,
    trainerId: row.trainer_id,
  };
}
