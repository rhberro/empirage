import type { FakeDatabase, FakeRow, Filter, Order, QueryState } from './fakeQuery';

/** The execution of the in-memory queries of the tests. */

export function executeQuery(db: FakeDatabase, table: string, state: QueryState): unknown {
  const rows = readTable(db, table);
  if (state.operation === 'insert' || state.operation === 'upsert') {
    return insertRows(db, table, rows, state);
  }
  if (state.operation === 'update') {
    return updateRows(db, table, rows, state);
  }
  if (state.operation === 'delete') {
    return deleteRows(db, table, rows, state);
  }
  return selectRows(rows, state);
}

function readTable(db: FakeDatabase, table: string): FakeRow[] {
  const rows = db.rows.get(table);
  if (rows !== undefined) {
    return rows;
  }
  const created: FakeRow[] = [];
  db.rows.set(table, created);
  return created;
}

function selectRows(rows: FakeRow[], state: QueryState): unknown {
  const matching = sortRows(filterRows(rows, state.filters), state.order);
  return readResult(matching, state);
}

function insertRows(db: FakeDatabase, table: string, rows: FakeRow[], state: QueryState): unknown {
  const payload = Array.isArray(state.payload)
    ? (state.payload as FakeRow[])
    : [state.payload as FakeRow];
  const inserted = payload.map(function withDefaults(row: FakeRow): FakeRow {
    return addDefaults(db, table, row);
  });
  rows.push(...inserted);
  db.writes.push({ operation: 'insert', payload: state.payload, table });
  return readResult(inserted, state);
}

function updateRows(db: FakeDatabase, table: string, rows: FakeRow[], state: QueryState): unknown {
  const matching = filterRows(rows, state.filters);
  const patch = state.payload as FakeRow;
  for (const row of matching) {
    Object.assign(row, patch);
  }
  db.writes.push({ operation: 'update', payload: state.payload, table });
  return readResult(matching, state);
}

function deleteRows(db: FakeDatabase, table: string, rows: FakeRow[], state: QueryState): unknown {
  const matching = filterRows(rows, state.filters);
  const removed = new Set(matching);
  const kept = rows.filter(function keep(row: FakeRow): boolean {
    return !removed.has(row);
  });
  db.rows.set(table, kept);
  db.writes.push({ operation: 'delete', payload: state.payload, table });
  return readResult(matching, state);
}

function addDefaults(db: FakeDatabase, table: string, row: FakeRow): FakeRow {
  const copy = { ...row };
  if (table !== 'hunt_sessions') {
    return copy;
  }
  if (typeof copy.id !== 'string') {
    copy.id = `session-${db.nextSessionId}`;
    db.nextSessionId += 1;
  }
  copy.actions = copy.actions ?? [];
  copy.encounters = copy.encounters ?? 0;
  copy.end_reason = copy.end_reason ?? null;
  copy.ended_at = copy.ended_at ?? null;
  copy.kills = copy.kills ?? 0;
  copy.simulation_state = copy.simulation_state ?? null;
  copy.stamina_spent_minutes = copy.stamina_spent_minutes ?? 0;
  return copy;
}

function filterRows(rows: FakeRow[], filters: Filter[]): FakeRow[] {
  return rows.filter(function matches(row: FakeRow): boolean {
    return filters.every(function matchesFilter(filter: Filter): boolean {
      return matchesOne(row[filter.column], filter);
    });
  });
}

function matchesOne(value: unknown, filter: Filter): boolean {
  if (filter.operation === 'eq') {
    return value === filter.value;
  }
  if (filter.operation === 'in') {
    return Array.isArray(filter.value) && filter.value.includes(value);
  }
  if (filter.operation === 'gt') {
    return compareValues(value, filter.value) > 0;
  }
  if (filter.operation === 'gte') {
    return compareValues(value, filter.value) >= 0;
  }
  if (filter.operation === 'lt') {
    return compareValues(value, filter.value) < 0;
  }
  return compareValues(value, filter.value) <= 0;
}

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function sortRows(rows: FakeRow[], orders: Order[]): FakeRow[] {
  const sorted = [...rows];
  for (const order of orders) {
    sorted.sort(function compare(left: FakeRow, right: FakeRow): number {
      const result = compareValues(left[order.column], right[order.column]);
      return order.ascending ? result : -result;
    });
  }
  return sorted;
}

function readResult(rows: FakeRow[], state: QueryState): unknown {
  const limited = state.limit === null ? rows : rows.slice(0, state.limit);
  if (state.mode === 'many') {
    return { data: limited, error: null };
  }
  return { data: limited[0] ?? null, error: null };
}
