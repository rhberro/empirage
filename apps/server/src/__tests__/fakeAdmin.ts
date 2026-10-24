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
export function buildTrainerAdmin(
  trainerId: string,
  ownerId: string,
  positions?: PositionAdminOptions,
): SupabaseClient {
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
  return buildFakeAdmin(trainerRow, positions);
}

/** The shape of a row of the durable position of a trainer. */
export type TrainerPositionRow = {
  facing: string;
  trainer_id: string;
  x: number;
  y: number;
};

export type PositionAdminOptions = {
  /** The rows the database already has. */
  positions?: TrainerPositionRow[];
  /** Receives every upsert, so a test can see what was written and when. */
  saves?: TrainerPositionRow[];
  /** How long a position read or write takes, to hold a flush open. */
  delayMs?: number;
};

type FakeDatabase = {
  delayMs: number;
  positions: TrainerPositionRow[];
  saves?: TrainerPositionRow[];
};

/**
 * The database of the unit tests: the trainer is the only row that exists.
 */
export function buildFakeAdmin(
  trainerRow?: TrainerRow,
  options?: PositionAdminOptions,
): SupabaseClient {
  const database: FakeDatabase = {
    delayMs: options?.delayMs ?? 0,
    positions: (options?.positions ?? []).map(function copy(row): TrainerPositionRow {
      return { ...row };
    }),
    saves: options?.saves,
  };
  return {
    from: function from(table: string): unknown {
      if (table === 'trainer_positions') {
        return buildPositionTable(database);
      }
      const rows = table === 'trainers' && trainerRow !== undefined ? [trainerRow] : [];
      return buildQuery(rows, false);
    },
  } as unknown as SupabaseClient;
}

/**
 * The table of the durable positions: the read answers the row of the
 * trainer and the upsert replaces or creates it.
 */
function buildPositionTable(database: FakeDatabase): unknown {
  const eq = buildPositionEq(database);
  return {
    select: function select(): unknown {
      return { eq };
    },
    upsert: function upsert(row: TrainerPositionRow): Promise<unknown> {
      writePositionRow(database, row);
      return buildDelayedAnswer({ data: null, error: null }, database.delayMs);
    },
  };
}

function buildPositionEq(database: FakeDatabase): (column: string, value: string) => unknown {
  return function eq(column: string, value: string): unknown {
    return buildPositionRead(database, column, value);
  };
}

function buildPositionRead(database: FakeDatabase, column: string, value: string): unknown {
  const row = column === 'trainer_id' ? findPosition(database.positions, value) : null;
  return {
    maybeSingle: function maybeSingle(): Promise<unknown> {
      return buildDelayedAnswer({ data: row, error: null }, database.delayMs);
    },
    single: function single(): Promise<unknown> {
      return buildDelayedAnswer({ data: row, error: null }, database.delayMs);
    },
  };
}

function findPosition(
  positions: TrainerPositionRow[],
  trainerId: string,
): TrainerPositionRow | null {
  for (const entry of positions) {
    if (entry.trainer_id === trainerId) {
      return entry;
    }
  }
  return null;
}

function findPositionIndex(positions: TrainerPositionRow[], trainerId: string): number {
  for (let index = 0; index < positions.length; index += 1) {
    if (positions[index].trainer_id === trainerId) {
      return index;
    }
  }
  return -1;
}

function writePositionRow(database: FakeDatabase, row: TrainerPositionRow): void {
  const saved = { ...row };
  const index = findPositionIndex(database.positions, saved.trainer_id);
  if (index >= 0) {
    database.positions[index] = saved;
  } else {
    database.positions.push(saved);
  }
  database.saves?.push(saved);
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
  if (delayMs <= 0) {
    return Promise.resolve(value);
  }
  return new globalThis.Promise(function resolveLater(resolve: (answer: unknown) => void): void {
    setTimeout(function deliver(): void {
      resolve(value);
    }, delayMs);
  });
}
