import { expect, test } from 'bun:test';

import type { HuntSession } from '@creatures/contracts/huntSession';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  appendHuntAction,
  finishHuntSession,
  listActiveHuntSessionsBehind,
  readActiveHuntSession,
  saveHuntCursor,
  startHuntSession,
} from '~/hunt/session';

const START = Date.parse('2026-10-21T12:00:00.000Z');
const SESSION_ID = '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01';
const AREA_ID = '9d0e1f2a-3b4c-4d5e-8f6a-9b0c1d2e3f4a';
const TRAINER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ACCOUNT_ID = '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e';

const ROW = {
  account_id: ACCOUNT_ID,
  actions: [],
  encounters: 0,
  end_reason: null,
  ended_at: null,
  hunt_area_id: AREA_ID,
  id: SESSION_ID,
  kills: 0,
  last_simulated_at: new Date(START).toISOString(),
  rng_draws: 0,
  rng_seed: 42,
  stamina_at_start: 480,
  stamina_spent_minutes: 0,
  started_at: new Date(START).toISOString(),
  status: 'active',
  trainer_id: TRAINER_ID,
};

/**
 * The calls the repository made to the client of Supabase.
 */
type RecordedCall = {
  operation: string;
  payload: unknown;
};

/**
 * A chain of calls that records what was asked and answers with a row.
 *
 * The chain answers every method with itself, and the methods that end a query
 * answer with the row. It is enough for the repository, which never mixes two
 * operations in the same query.
 */
function buildQuery(table: string, rows: unknown[], calls: RecordedCall[]): Promise<unknown> {
  const list = Promise.resolve({ data: rows, error: null });
  const one = Promise.resolve({ data: rows.at(0) ?? null, error: null });
  return Object.assign(list, {
    eq: function eq(column: string, value: unknown): Promise<unknown> {
      calls.push({ operation: `eq:${table}.${column}`, payload: value });
      return list;
    },
    insert: function insert(payload: unknown): Promise<unknown> {
      calls.push({ operation: `insert:${table}`, payload });
      return list;
    },
    lt: function lt(column: string, value: unknown): Promise<unknown> {
      calls.push({ operation: `lt:${table}.${column}`, payload: value });
      return list;
    },
    maybeSingle: function maybeSingle(): Promise<unknown> {
      return one;
    },
    order: function order(): Promise<unknown> {
      return list;
    },
    select: function select(): Promise<unknown> {
      return list;
    },
    single: function single(): Promise<unknown> {
      return one;
    },
    update: function update(payload: unknown): Promise<unknown> {
      calls.push({ operation: `update:${table}`, payload });
      return list;
    },
  });
}

type FakeClient = {
  calls: RecordedCall[];
  client: SupabaseClient;
};

function buildFakeClient(rows: unknown[]): FakeClient {
  const calls: RecordedCall[] = [];
  const client = {
    from: function from(table: string): Promise<unknown> {
      return buildQuery(table, rows, calls);
    },
  };
  return { calls, client: client as unknown as SupabaseClient };
}

function readsTheRow(operation: string, calls: RecordedCall[]): RecordedCall | undefined {
  return calls.find(function find(call: RecordedCall): boolean {
    return call.operation === operation;
  });
}

function theSessionIsCreated(): Promise<void> {
  const fake = buildFakeClient([ROW]);
  return startHuntSession(fake.client, {
    accountId: ACCOUNT_ID,
    huntAreaId: AREA_ID,
    rngSeed: 42,
    staminaAtStart: 480,
    startedAt: START,
    trainerId: TRAINER_ID,
  }).then(function assertSession(session: HuntSession): void {
    expect(session.id).toBe(SESSION_ID);
    expect(session.status).toBe('active');
    expect(session.startedAt).toBe(START);
    expect(session.staminaAtStart).toBe(480);
    const insert = readsTheRow('insert:hunt_sessions', fake.calls);
    const payload = insert?.payload as Record<string, unknown>;
    expect(payload.stamina_at_start).toBe(480);
  });
}

function theActiveSessionOfTheTrainerIsRead(): Promise<void> {
  const fake = buildFakeClient([ROW]);
  return readActiveHuntSession(fake.client, TRAINER_ID).then(function assertSession(
    session: HuntSession | null,
  ): void {
    expect(session?.id).toBe(SESSION_ID);
    expect(session?.staminaAtStart).toBe(480);
    expect(readsTheRow('eq:hunt_sessions.trainer_id', fake.calls)).toBeDefined();
    expect(readsTheRow('eq:hunt_sessions.status', fake.calls)).toBeDefined();
  });
}

function theSessionsBehindTheCursorAreListed(): Promise<void> {
  const fake = buildFakeClient([ROW]);
  return listActiveHuntSessionsBehind(fake.client, START + 60_000).then(function assertSessions(
    sessions: HuntSession[],
  ): void {
    expect(sessions.length).toBe(1);
    expect(sessions[0]?.id).toBe(SESSION_ID);
    const filter = readsTheRow('lt:hunt_sessions.last_simulated_at', fake.calls);
    expect(filter?.payload).toBe(new Date(START + 60_000).toISOString());
  });
}

function theCursorIsWritten(): Promise<void> {
  const fake = buildFakeClient([ROW]);
  const session: HuntSession = {
    accountId: ACCOUNT_ID,
    actions: [],
    encounters: 0,
    endReason: null,
    endedAt: null,
    huntAreaId: AREA_ID,
    id: SESSION_ID,
    kills: 0,
    lastSimulatedAt: START + 120_000,
    rngDraws: 7,
    rngSeed: 42,
    staminaAtStart: 480,
    staminaSpentMinutes: 2,
    startedAt: START,
    status: 'active',
    trainerId: TRAINER_ID,
  };
  return saveHuntCursor(fake.client, session).then(function assertWrite(): void {
    const update = readsTheRow('update:hunt_sessions', fake.calls);
    const payload = update?.payload as Record<string, unknown>;
    expect(payload.last_simulated_at).toBe(new Date(START + 120_000).toISOString());
    expect(payload.stamina_spent_minutes).toBe(2);
    expect(payload.stamina_at_start).toBe(480);
    expect(payload.rng_draws).toBe(7);
  });
}

function theActionIsWrittenInTheTimeline(): Promise<void> {
  const fake = buildFakeClient([ROW]);
  return appendHuntAction(fake.client, SESSION_ID, {
    at: START + 1000,
    creatureId: 'creature-1',
    type: 'swap_creature',
  }).then(function assertWrite(): void {
    const update = readsTheRow('update:hunt_sessions', fake.calls);
    const payload = update?.payload as Record<string, unknown>;
    const actions = payload.actions as { at: number }[];
    expect(actions.length).toBe(1);
    expect(actions[0]?.at).toBe(START + 1000);
  });
}

function theSessionIsClosedInSoftClose(): Promise<void> {
  const fake = buildFakeClient([ROW]);
  const endedAt = START + 600_000;
  return finishHuntSession(fake.client, SESSION_ID, 'stamina_depleted', endedAt).then(
    function assertWrite(): void {
      const update = readsTheRow('update:hunt_sessions', fake.calls);
      const payload = update?.payload as Record<string, unknown>;
      expect(payload.status).toBe('finished');
      expect(payload.end_reason).toBe('stamina_depleted');
      expect(payload.ended_at).toBe(new Date(endedAt).toISOString());
    },
  );
}

function theSessionIsNeverDeleted(): Promise<void> {
  const fake = buildFakeClient([ROW]);
  return finishHuntSession(fake.client, SESSION_ID, 'player_finalized', START).then(
    function assertNoDelete(): void {
      const deleted = fake.calls.find(function find(call: RecordedCall): boolean {
        return call.operation.startsWith('delete');
      });
      expect(deleted).toBeUndefined();
    },
  );
}

test('the session is created', theSessionIsCreated);
test('the active session of the trainer is read', theActiveSessionOfTheTrainerIsRead);
test('the sessions behind the cursor are listed', theSessionsBehindTheCursorAreListed);
test('the cursor is written', theCursorIsWritten);
test('the action is written in the timeline', theActionIsWrittenInTheTimeline);
test('the session is closed in soft-close', theSessionIsClosedInSoftClose);
test('the session is never deleted', theSessionIsNeverDeleted);
