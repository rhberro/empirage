import type { SupabaseClient } from '@supabase/supabase-js';

import type { FakeDatabase, FakeQuery, FakeRow } from './fakeQuery';
import { buildQuery } from './fakeQuery';

export type { FakeDatabase, FakeRow, FakeWrite } from './fakeQuery';

export type FakeHuntAdmin = {
  admin: SupabaseClient;
  db: FakeDatabase;
};

export function buildHuntAdmin(seed?: Record<string, FakeRow[]>): FakeHuntAdmin {
  const rows = new Map<string, FakeRow[]>();
  for (const [table, list] of Object.entries(seed ?? {})) {
    rows.set(
      table,
      list.map(function copy(row: FakeRow): FakeRow {
        return { ...row };
      }),
    );
  }
  const db: FakeDatabase = { nextSessionId: 1, rows, writes: [] };
  const admin = {
    from: function from(table: string): FakeQuery {
      return buildQuery(db, table);
    },
  } as unknown as SupabaseClient;
  return { admin, db };
}

export function readRowsOf(db: FakeDatabase, table: string): FakeRow[] {
  return db.rows.get(table) ?? [];
}

export function findRow(
  db: FakeDatabase,
  table: string,
  column: string,
  value: unknown,
): FakeRow | undefined {
  return readRowsOf(db, table).find(function match(row: FakeRow): boolean {
    return row[column] === value;
  });
}
