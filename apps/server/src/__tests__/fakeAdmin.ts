import type { SupabaseClient } from '@supabase/supabase-js';

import type { TrainerRow } from '~/db/types';

export const STARTER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/**
 * The query of the database of the unit tests.
 *
 * Every filter is a chain that answers with the same rows, because the unit
 * tests never read a real table. The query is a promise, because that is how
 * the repositories wait for it.
 */
function buildQuery(rows: unknown[], single: boolean): unknown {
  const data = single ? (rows[0] ?? null) : rows;
  const answer = Promise.resolve({ data, error: null });
  return Object.assign(answer, {
    eq: function eq(): unknown {
      return answer;
    },
    gt: function gt(): unknown {
      return answer;
    },
    gte: function gte(): unknown {
      return answer;
    },
    limit: function limit(): unknown {
      return answer;
    },
    lt: function lt(): unknown {
      return answer;
    },
    lte: function lte(): unknown {
      return answer;
    },
    maybeSingle: function maybeSingle(): unknown {
      return buildQuery(rows, true);
    },
    order: function order(): unknown {
      return answer;
    },
    select: function select(): unknown {
      return answer;
    },
    single: function singleRow(): unknown {
      return buildQuery(rows, true);
    },
  });
}

/**
 * A client that answers with an empty catalog, for the routes that read
 * public content.
 */
export function buildEmptyAdmin(): SupabaseClient {
  return buildFakeAdmin();
}

/**
 * A client that answers with a trainer of the account, for the routes that
 * read the trainer of the session.
 */
export function buildTrainerAdmin(trainerId: string, ownerId: string): SupabaseClient {
  const trainerRow: TrainerRow = {
    created_at: '2026-01-01T00:00:00.000Z',
    diamonds: 0,
    gender: 'male',
    gold: 100,
    id: trainerId,
    level: 1,
    name: 'Beto',
    owner_id: ownerId,
    stamina_minutes: 480,
    starter_species_id: STARTER_ID,
  };
  return buildFakeAdmin(trainerRow);
}

/**
 * The database of the unit tests: the trainer is the only row that exists.
 */
export function buildFakeAdmin(trainerRow?: TrainerRow): SupabaseClient {
  return {
    from: function from(table: string): unknown {
      const rows = table === 'trainers' && trainerRow !== undefined ? [trainerRow] : [];
      return buildQuery(rows, false);
    },
  } as unknown as SupabaseClient;
}

export type StoreAdminOptions = {
  /** How long the operation of the store takes, to hold two requests. */
  delayMs?: number;
  /** How many times the operation of the store ran. */
  calls?: { count: number };
  /** The refusal of the operation of the store. */
  error?: { code: string; message: string };
  /** The answer of the operation of the store. */
  outcome?: { gold: number; total: number };
};

/**
 * A client whose operation of the store answers after a while.
 *
 * The delay is what puts two requests of the same key in flight at the same
 * time, which is the case the reservation of the key exists for.
 */
export function buildStoreAdmin(options?: StoreAdminOptions): SupabaseClient {
  const base = buildFakeAdmin();
  const delayMs = options?.delayMs ?? 0;
  const calls = options?.calls;
  const error = options?.error ?? null;
  const outcome = options?.outcome ?? { gold: 100, total: 20 };
  return {
    from: base.from,
    rpc: function rpc(): Promise<unknown> {
      if (calls !== undefined) {
        calls.count += 1;
      }
      return buildDelayedAnswer({ data: outcome, error }, delayMs);
    },
  } as unknown as SupabaseClient;
}

/**
 * The answer of the database, after a while.
 */
function buildDelayedAnswer(value: unknown, delayMs: number): Promise<unknown> {
  return new globalThis.Promise(function resolveLater(resolve: (answer: unknown) => void): void {
    setTimeout(function deliver(): void {
      resolve(value);
    }, delayMs);
  });
}
