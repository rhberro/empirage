/* eslint-disable max-lines */
import { expect, test } from 'bun:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import { validateDestroyItemCommand } from '~/validation/inventory';

import {
  DESTROY_ITEM_PATH,
  TRAINER_ID,
  USER_ID,
  USER_TOKEN,
  buildDependencies,
  buildHandler,
  buildJsonRequest,
  buildRecordingBroadcaster,
  readError,
  send,
} from './support';
import type { BroadcastRecorder } from './support';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ITEM_ID = '22222222-2222-4222-8222-222222222222';

type FakeBackpack = {
  equipped: Set<string>;
  failUpdate: boolean;
  quantities: Map<string, number>;
  updates: number;
};

type TestState = {
  deps: ReturnType<typeof buildDependencies>;
  recorder: BroadcastRecorder;
  state: FakeBackpack;
};

function buildState(): FakeBackpack {
  return { equipped: new Set<string>(), failUpdate: false, quantities: new Map(), updates: 0 };
}

function buildSetup(): TestState {
  const state = buildState();
  const recorder = buildRecordingBroadcaster();
  const deps = buildDependencies({
    admin: buildFakeAdmin(state),
    broadcaster: recorder.broadcaster,
  });
  deps.sessions.set(USER_ID, TRAINER_ID);
  return { deps, recorder, state };
}

function buildFakeAdmin(state: FakeBackpack): SupabaseClient {
  return {
    from: function from(table: string): unknown {
      return buildQuery(table, state);
    },
  } as unknown as SupabaseClient;
}

function buildQuery(table: string, state: FakeBackpack): unknown {
  const filters: Record<string, unknown> = {};
  let operation: 'read' | 'update' | 'delete' = 'read';
  let values: Record<string, unknown> = {};
  const answer = Promise.resolve().then(function answerLater(): unknown {
    return readMany(table, state, operation, filters, values);
  });
  const query = Object.assign(answer, {
    delete: function del(): unknown {
      operation = 'delete';
      return query;
    },
    eq: function eq(column: string, value: unknown): unknown {
      filters[column] = value;
      return query;
    },
    limit: function limit(): unknown {
      return query;
    },
    maybeSingle: function maybeSingle(): Promise<unknown> {
      return Promise.resolve(readSingle(table, state, filters));
    },
    select: function select(): unknown {
      return query;
    },
    update: function update(next: Record<string, unknown>): unknown {
      operation = 'update';
      values = next;
      return query;
    },
  });
  return query;
}

function readSingle(table: string, state: FakeBackpack, filters: Record<string, unknown>): unknown {
  if (table !== 'trainer_items') {
    return { data: null, error: null };
  }
  const quantity = state.quantities.get(String(filters.item_id));
  if (quantity === undefined) {
    return { data: null, error: null };
  }
  return { data: { quantity }, error: null };
}

function readMany(
  table: string,
  state: FakeBackpack,
  operation: 'read' | 'update' | 'delete',
  filters: Record<string, unknown>,
  values: Record<string, unknown>,
): unknown {
  if (operation === 'update') {
    return writeUpdate(state, filters, values);
  }
  if (operation === 'delete') {
    return writeDelete(state, filters);
  }
  if (table !== 'trainer_gear_slots') {
    return { data: [], error: null };
  }
  const itemId = String(filters.item_id);
  return { data: state.equipped.has(itemId) ? [{ item_id: itemId }] : [], error: null };
}

function writeUpdate(
  state: FakeBackpack,
  filters: Record<string, unknown>,
  values: Record<string, unknown>,
): unknown {
  state.updates += 1;
  if (state.failUpdate) {
    return { data: null, error: { code: 'XX000', message: 'update failed' } };
  }
  const itemId = String(filters.item_id);
  const quantity = state.quantities.get(itemId);
  if (quantity === undefined || quantity !== filters.quantity) {
    return { data: [], error: null };
  }
  const next = Number(values.quantity);
  state.quantities.set(itemId, next);
  return { data: [{ quantity: next }], error: null };
}

function writeDelete(state: FakeBackpack, filters: Record<string, unknown>): unknown {
  state.updates += 1;
  if (state.failUpdate) {
    return { data: null, error: { code: 'XX000', message: 'update failed' } };
  }
  const itemId = String(filters.item_id);
  const quantity = state.quantities.get(itemId);
  if (quantity === undefined) {
    return { data: [], error: null };
  }
  state.quantities.delete(itemId);
  return { data: [{ item_id: itemId }], error: null };
}

function sendDestroy(setup: TestState, itemId: string, key?: string): Promise<Response> {
  const request = buildJsonRequest('POST', DESTROY_ITEM_PATH, { itemId }, USER_TOKEN);
  if (key !== undefined) {
    request.headers.set('Idempotency-Key', key);
  }
  return send(buildHandler(setup.deps), request);
}

function readBodyCode(response: Response): Promise<string> {
  return readError(response).then(function readCode(body: { error: string }): string {
    return body.error;
  });
}

function acceptsAValidCommand(): void {
  const result = validateDestroyItemCommand({ itemId: ITEM_ID });
  expect(result.ok).toBe(true);
}

function refusesAMalformedItem(): void {
  const result = validateDestroyItemCommand({ itemId: 'not-a-uuid' });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('destroy_item_invalid_item');
  }
}

function refusesAnItemThatIsNotOwned(): Promise<void> {
  const setup = buildSetup();
  return sendDestroy(setup, ITEM_ID).then(function assertRefusal(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(404);
    return readBodyCode(response).then(function assertCode(code: string): void {
      expect(code).toBe('destroy_item_not_in_backpack');
      expect(setup.state.updates).toBe(0);
      expect(setup.recorder.pushes).toHaveLength(0);
    });
  });
}

function refusesAMalformedItemAtTheRoute(): Promise<void> {
  const setup = buildSetup();
  return sendDestroy(setup, 'not-a-uuid').then(function assertRefusal(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(400);
    return readBodyCode(response).then(function assertCode(code: string): void {
      expect(code).toBe('destroy_item_invalid_item');
      expect(setup.state.updates).toBe(0);
    });
  });
}

function refusesAnEquippedItem(): Promise<void> {
  const setup = buildSetup();
  setup.state.quantities.set(ITEM_ID, 2);
  setup.state.equipped.add(ITEM_ID);
  return sendDestroy(setup, ITEM_ID).then(function assertRefusal(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(409);
    return readBodyCode(response).then(function assertCode(code: string): void {
      expect(code).toBe('destroy_item_equipped');
      expect(setup.state.quantities.get(ITEM_ID)).toBe(2);
      expect(setup.state.updates).toBe(0);
      expect(setup.recorder.pushes).toHaveLength(0);
    });
  });
}

function destroysTheLastUnitAndPushesTheState(): Promise<void> {
  const setup = buildSetup();
  setup.state.quantities.set(ITEM_ID, 1);
  return sendDestroy(setup, ITEM_ID).then(function assertDestroyed(response: Response): void {
    expect(response.status).toBe(204);
    expect(setup.state.quantities.get(ITEM_ID)).toBeUndefined();
    expect(setup.recorder.pushes).toEqual([{ trainerId: TRAINER_ID, userId: USER_ID }]);
  });
}

function destroysOneUnitOfABiggerStack(): Promise<void> {
  const setup = buildSetup();
  setup.state.quantities.set(ITEM_ID, 3);
  return sendDestroy(setup, ITEM_ID).then(function assertDestroyed(response: Response): void {
    expect(response.status).toBe(204);
    expect(setup.state.quantities.get(ITEM_ID)).toBeUndefined();
    expect(setup.state.quantities.get(OTHER_ITEM_ID)).toBeUndefined();
    expect(setup.state.updates).toBe(1);
  });
}

function keepsTheResultOfTheKey(): Promise<void> {
  const setup = buildSetup();
  setup.state.quantities.set(ITEM_ID, 3);
  return sendDestroy(setup, ITEM_ID, 'key-1')
    .then(function destroyOnce(response: Response): Promise<Response> {
      expect(response.status).toBe(204);
      return sendDestroy(setup, ITEM_ID, 'key-1');
    })
    .then(function assertReplay(response: Response): void {
      expect(response.status).toBe(204);
      expect(setup.state.quantities.get(ITEM_ID)).toBeUndefined();
      expect(setup.state.updates).toBe(1);
      expect(setup.recorder.pushes).toHaveLength(1);
    });
}

function freesTheKeyOfARefusal(): Promise<void> {
  const setup = buildSetup();
  setup.state.quantities.set(ITEM_ID, 1);
  setup.state.equipped.add(ITEM_ID);
  return sendDestroy(setup, ITEM_ID, 'key-2')
    .then(function assertRefusal(response: Response): Promise<Response> {
      expect(response.status).toBe(409);
      setup.state.equipped.delete(ITEM_ID);
      return sendDestroy(setup, ITEM_ID, 'key-2');
    })
    .then(function assertDestroyed(response: Response): void {
      expect(response.status).toBe(204);
      expect(setup.state.quantities.get(ITEM_ID)).toBeUndefined();
      expect(setup.state.updates).toBe(1);
    });
}

function mapsADatabaseFailureToAnInternalError(): Promise<void> {
  const setup = buildSetup();
  setup.state.quantities.set(ITEM_ID, 1);
  setup.state.failUpdate = true;
  return sendDestroy(setup, ITEM_ID).then(function assertFailure(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(500);
    return readBodyCode(response).then(function assertCode(code: string): void {
      expect(code).toBe('destroy_item_internal_error');
      expect(setup.recorder.pushes).toHaveLength(0);
    });
  });
}

test('the destroy command accepts a valid item', acceptsAValidCommand);
test('the destroy command refuses a malformed item', refusesAMalformedItem);
test('an item the trainer does not own is not found', refusesAnItemThatIsNotOwned);
test('a malformed item at the route is a bad request', refusesAMalformedItemAtTheRoute);
test('an equipped item is refused', refusesAnEquippedItem);
test(
  'the last unit leaves the stack at zero and pushes the state',
  destroysTheLastUnitAndPushesTheState,
);
test('one unit of a bigger stack is destroyed', destroysOneUnitOfABiggerStack);
test('a retried command does not destroy twice', keepsTheResultOfTheKey);
test('the key of a refusal is free', freesTheKeyOfARefusal);
test('a database failure is an internal error', mapsADatabaseFailureToAnInternalError);
