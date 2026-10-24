import { executeQuery } from './fakeExecute';

/**
 * A small in-memory Supabase query builder for the tests of the hunt runtime.
 *
 * It implements the subset the repositories use: filters, ordering, limit,
 * one-row reads and the four write operations. Joined rows arrive already
 * embedded in the seed, because the tests never talk to PostgREST.
 */

export type FakeRow = Record<string, unknown>;

export type FakeWrite = {
  operation: 'delete' | 'insert' | 'update' | 'upsert';
  payload: unknown;
  table: string;
};

export type FakeDatabase = {
  nextSessionId: number;
  rows: Map<string, FakeRow[]>;
  writes: FakeWrite[];
};

export type FilterOperation = 'eq' | 'gt' | 'gte' | 'in' | 'lt' | 'lte';

export type Filter = {
  column: string;
  operation: FilterOperation;
  value: unknown;
};

type QueryOperation = 'delete' | 'insert' | 'select' | 'update' | 'upsert';

type QueryMode = 'many' | 'maybe' | 'one';

export type Order = {
  ascending: boolean;
  column: string;
};

export type QueryState = {
  filters: Filter[];
  limit: number | null;
  mode: QueryMode;
  operation: QueryOperation;
  order: Order[];
  payload: unknown;
};

export type FakeQuery = Promise<unknown> & {
  delete(): FakeQuery;
  eq(column: string, value: unknown): FakeQuery;
  gt(column: string, value: unknown): FakeQuery;
  gte(column: string, value: unknown): FakeQuery;
  in(column: string, value: unknown): FakeQuery;
  insert(payload: unknown): FakeQuery;
  limit(value: number): FakeQuery;
  lt(column: string, value: unknown): FakeQuery;
  lte(column: string, value: unknown): FakeQuery;
  maybeSingle(): FakeQuery;
  order(column: string, options?: { ascending?: boolean }): FakeQuery;
  select(): FakeQuery;
  single(): FakeQuery;
  update(payload: unknown): FakeQuery;
  upsert(payload: unknown): FakeQuery;
};

/**
 * Builds a query that runs when it is awaited.
 *
 * The methods mutate a shared state synchronously; the execution is scheduled
 * as a microtask, after the whole chain was built.
 */
type BuilderRef = {
  builder: FakeQuery | null;
};

/**
 * Builds a query that runs when it is awaited.
 *
 * The methods mutate a shared state synchronously; the execution is scheduled
 * as a microtask, after the whole chain was built.
 */
export function buildQuery(db: FakeDatabase, table: string): FakeQuery {
  const state: QueryState = {
    filters: [],
    limit: null,
    mode: 'many',
    operation: 'select',
    order: [],
    payload: null,
  };
  const ref: BuilderRef = { builder: null };
  const answer = Promise.resolve().then(function execute(): unknown {
    return executeQuery(db, table, state);
  });
  const methods = {
    ...buildFilterMethods(state, ref),
    ...buildModeMethods(state, ref),
    ...buildWriteMethods(state, ref),
  };
  const builder = Object.assign(answer, methods) as unknown as FakeQuery;
  ref.builder = builder;
  return builder;
}

function readBuilder(ref: BuilderRef): FakeQuery {
  if (ref.builder === null) {
    throw new Error('the query builder was read before it was built');
  }
  return ref.builder;
}

function buildFilterMethods(
  state: QueryState,
  ref: BuilderRef,
): Record<string, (column: string, value: unknown) => FakeQuery> {
  return {
    eq: function eq(column: string, value: unknown): FakeQuery {
      state.filters.push({ column, operation: 'eq', value });
      return readBuilder(ref);
    },
    gt: function gt(column: string, value: unknown): FakeQuery {
      state.filters.push({ column, operation: 'gt', value });
      return readBuilder(ref);
    },
    gte: function gte(column: string, value: unknown): FakeQuery {
      state.filters.push({ column, operation: 'gte', value });
      return readBuilder(ref);
    },
    in: function inList(column: string, value: unknown): FakeQuery {
      state.filters.push({ column, operation: 'in', value });
      return readBuilder(ref);
    },
    lt: function lt(column: string, value: unknown): FakeQuery {
      state.filters.push({ column, operation: 'lt', value });
      return readBuilder(ref);
    },
    lte: function lte(column: string, value: unknown): FakeQuery {
      state.filters.push({ column, operation: 'lte', value });
      return readBuilder(ref);
    },
  };
}

function buildModeMethods(state: QueryState, ref: BuilderRef): Record<string, () => FakeQuery> {
  return {
    delete: function deleteQuery(): FakeQuery {
      state.operation = 'delete';
      return readBuilder(ref);
    },
    maybeSingle: function maybeSingle(): FakeQuery {
      state.mode = 'maybe';
      return readBuilder(ref);
    },
    select: function select(): FakeQuery {
      return readBuilder(ref);
    },
    single: function single(): FakeQuery {
      state.mode = 'one';
      return readBuilder(ref);
    },
  };
}

function buildWriteMethods(
  state: QueryState,
  ref: BuilderRef,
): Record<string, (...args: never[]) => FakeQuery> {
  return {
    insert: function insert(payload: unknown): FakeQuery {
      state.operation = 'insert';
      state.payload = payload;
      return readBuilder(ref);
    },
    limit: function limit(value: number): FakeQuery {
      state.limit = value;
      return readBuilder(ref);
    },
    order: function order(column: string, options?: { ascending?: boolean }): FakeQuery {
      state.order.push({ ascending: options?.ascending ?? true, column });
      return readBuilder(ref);
    },
    update: function update(payload: unknown): FakeQuery {
      state.operation = 'update';
      state.payload = payload;
      return readBuilder(ref);
    },
    upsert: function upsert(payload: unknown): FakeQuery {
      state.operation = 'upsert';
      state.payload = payload;
      return readBuilder(ref);
    },
  };
}
