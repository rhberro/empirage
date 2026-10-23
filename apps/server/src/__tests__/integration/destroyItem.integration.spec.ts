import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { cleanupEnvironment, countRows, prepareEnvironment, readToken } from './environment';
import type { IntegrationEnvironment } from './environment';
import { createTrainerWithSession, readRows, readState, sendJson } from './teamSupport';
import type { PlayerStatePayload, RowResult } from './teamSupport';

const ENABLED = globalThis.process.env.CREATURES_TEST_DB === '1';
const HOOK_TIMEOUT_MS = 60000;

const DESTROY_PATH = '/api/backpack/destroy';

const POCAO_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const MATERIAL_ID = '8c9d0e1f-2a3b-4c4d-9e5f-7a8b9c0d1e2f';

let env: IntegrationEnvironment;
let token = '';
let trainerId = '';

describe.skipIf(!ENABLED)(
  'the destroy of a backpack item against the real database',
  describeDestroy,
);

function describeDestroy(): void {
  beforeAll(prepareSuite, { timeout: HOOK_TIMEOUT_MS });
  afterAll(cleanupSuite, { timeout: HOOK_TIMEOUT_MS });

  test('one unit is destroyed and the reduced quantity persists', destroysOneUnit);
  test('the last unit leaves the stack at zero', destroysTheLastUnit);
  test('an item the trainer does not have is refused', refusesAnItemThatIsNotOwned);
  test('an equipped item is refused', refusesAnEquippedItem);
  test('the database is left without trainers', leavesEmptyDatabase);
}

function prepareSuite(): Promise<void> {
  return prepareEnvironment()
    .then(function store(environment: IntegrationEnvironment): Promise<void> {
      env = environment;
      return readToken(env, env.ownerEmail).then(function keepToken(accessToken: string): void {
        token = accessToken;
      });
    })
    .then(createTrainer);
}

function cleanupSuite(): Promise<unknown> {
  if (env === undefined) {
    return Promise.resolve();
  }
  return cleanupEnvironment(env);
}

function createTrainer(): Promise<void> {
  return createTrainerWithSession(env, token).then(function keepTrainer(id: string): void {
    trainerId = id;
  });
}

function destroysOneUnit(): Promise<void> {
  return giveItem(POCAO_ID, 3).then(function destroy(): Promise<void> {
    return sendJson(env, 'POST', DESTROY_PATH, { itemId: POCAO_ID }, token).then(
      function assertDestroyed(response: Response): Promise<void> {
        expect(response.status).toBe(204);
        return checkQuantity(POCAO_ID, 2);
      },
    );
  });
}

function destroysTheLastUnit(): Promise<void> {
  return giveItem(POCAO_ID, 1).then(function destroy(): Promise<void> {
    return sendJson(env, 'POST', DESTROY_PATH, { itemId: POCAO_ID }, token).then(
      function assertDestroyed(response: Response): Promise<void> {
        expect(response.status).toBe(204);
        return checkQuantity(POCAO_ID, 0).then(function assertBackpack(): Promise<void> {
          return readState(env, token).then(function withoutItem(state: PlayerStatePayload): void {
            const stack = state.backpack.find(function matches(entry: {
              name: string;
              quantity: number;
              slug: string;
            }): boolean {
              return entry.name === 'Poção de Cura';
            });
            expect(stack).toBeUndefined();
          });
        });
      },
    );
  });
}

function refusesAnItemThatIsNotOwned(): Promise<void> {
  return clearItem(MATERIAL_ID).then(function destroy(): Promise<void> {
    return sendJson(env, 'POST', DESTROY_PATH, { itemId: MATERIAL_ID }, token).then(
      function assertRefusal(response: Response): Promise<void> {
        expect(response.status).toBe(404);
        return response.json().then(function assertCode(body: unknown): void {
          expect((body as { error: string }).error).toBe('destroy_item_not_in_backpack');
        });
      },
    );
  });
}

function refusesAnEquippedItem(): Promise<void> {
  return clearGearSlots()
    .then(function give(): Promise<void> {
      return giveItem(POCAO_ID, 1);
    })
    .then(function equip(): Promise<void> {
      return equipItem(POCAO_ID);
    })
    .then(function destroy(): Promise<void> {
      return sendJson(env, 'POST', DESTROY_PATH, { itemId: POCAO_ID }, token).then(
        function assertRefusal(response: Response): Promise<void> {
          expect(response.status).toBe(409);
          return response.json().then(function assertCode(body: unknown): Promise<void> {
            expect((body as { error: string }).error).toBe('destroy_item_equipped');
            return checkQuantity(POCAO_ID, 1).then(function clear(): Promise<void> {
              return clearGearSlots();
            });
          });
        },
      );
    });
}

function leavesEmptyDatabase(): Promise<void> {
  let trainerIds: string[] = [];
  const ownTrainers = env.admin.from('trainers').select('id').eq('owner_id', env.ownerId);
  return Promise.resolve(ownTrainers.then(readRows))
    .then(function collect(result: RowResult): PromiseLike<RowResult> {
      trainerIds = (result.data ?? []).map(function readId(row: unknown): string {
        return (row as { id: string }).id;
      });
      const deletion = env.admin.from('trainers').delete().eq('owner_id', env.ownerId);
      return deletion.then(readRows);
    })
    .then(function assertTrainers(): PromiseLike<RowResult> {
      const remaining = env.admin.from('trainers').select('id').eq('owner_id', env.ownerId);
      return remaining.then(readRows);
    })
    .then(function assertOwnTrainers(result: RowResult): PromiseLike<RowResult> {
      expect(countRows(result)).toBe(0);
      const items = env.admin.from('trainer_items').select('item_id').in('trainer_id', trainerIds);
      return items.then(readRows);
    })
    .then(function assertItems(result: RowResult): void {
      expect(countRows(result)).toBe(0);
    });
}

function giveItem(itemId: string, quantity: number): Promise<void> {
  const query = env.admin
    .from('trainer_items')
    .upsert({ item_id: itemId, quantity, trainer_id: trainerId });
  return Promise.resolve(query).then(function written(): void {
    expect(true).toBe(true);
  });
}

function clearItem(itemId: string): Promise<void> {
  const query = env.admin
    .from('trainer_items')
    .delete()
    .eq('trainer_id', trainerId)
    .eq('item_id', itemId);
  return Promise.resolve(query).then(function cleared(): void {
    expect(true).toBe(true);
  });
}

function equipItem(itemId: string): Promise<void> {
  const row = {
    item_id: itemId,
    kind: 'consumable',
    slot: 4,
    trainer_id: trainerId,
    trigger_hp_percent: 50,
  };
  const query = env.admin.from('trainer_gear_slots').upsert(row, { onConflict: 'trainer_id,slot' });
  return Promise.resolve(query).then(function equipped(): void {
    expect(true).toBe(true);
  });
}

function clearGearSlots(): Promise<void> {
  const query = env.admin.from('trainer_gear_slots').delete().eq('trainer_id', trainerId);
  return Promise.resolve(query).then(function cleared(): void {
    expect(true).toBe(true);
  });
}

function checkQuantity(itemId: string, expected: number): Promise<void> {
  const stateRead = readState(env, token).then(function assertBackpack(
    state: PlayerStatePayload,
  ): void {
    const stack = state.backpack.find(function matches(entry: {
      category: string;
      name: string;
      quantity: number;
      slug: string;
    }): boolean {
      return entry.slug === 'pocao-de-cura' && itemId === POCAO_ID;
    });
    if (expected === 0) {
      expect(stack).toBeUndefined();
      return;
    }
    expect(stack?.quantity).toBe(expected);
  });
  return stateRead.then(function readDatabase(): Promise<void> {
    const query = env.admin
      .from('trainer_items')
      .select('quantity')
      .eq('trainer_id', trainerId)
      .eq('item_id', itemId)
      .maybeSingle();
    return Promise.resolve(query).then(function assertRow(result: {
      data: { quantity: number } | null;
      error: { message: string } | null;
    }): void {
      expect(result.error).toBeNull();
      expect(result.data?.quantity).toBe(expected);
    });
  });
}
