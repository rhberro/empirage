import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { BAD_REQUEST, NO_CONTENT } from '~/__tests__/support';

import { cleanupEnvironment, countRows, prepareEnvironment, readToken } from './environment';
import type { IntegrationEnvironment } from './environment';
import {
  giveItem,
  readEquippedAbilityId,
  readItem,
  readSlot,
  readSpeciesAbilities,
} from './skillBarSupport';
import type { AbilityPayload, ItemPayload } from './skillBarSupport';
import {
  createTrainerWithSession,
  readId,
  readRows,
  readState,
  sendJson,
  sendRequest,
} from './teamSupport';
import type { PlayerStatePayload, RowResult } from './teamSupport';

const ENABLED = globalThis.process.env.CREATURES_TEST_DB === '1';
const FOREIGN_ABILITY_ID = 'e4d5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a';

let env: IntegrationEnvironment;
let trainerId = '';
let starterCreatureId = '';
let token = '';

describe.skipIf(!ENABLED)('the skill bar against the real database', describeSkillBar);

function describeSkillBar(): void {
  beforeAll(prepareSuite);
  afterAll(cleanupSuite);

  test('the starter creature is born with the loadout of its species', startsWithTheLoadout);
  test('the state carries the life of the creature in the field', showsTheLifeOfTheCreature);
  test('the abilities of the species are equipped in the slots', equipsAbilities);
  test('an ability of another species is refused', refusesForeignAbility);
  test('a repeated ability is refused', refusesRepeatedAbility);
  test('the consumable slot takes an item with its trigger', equipsConsumable);
  test('the device slot takes a device', equipsDevice);
  test('a slot is emptied', emptiesTheSlot);
  test('the database is left without trainers and creatures', leavesEmptyDatabase);
}

function prepareSuite(): Promise<void> {
  return prepareEnvironment()
    .then(function store(environment: IntegrationEnvironment): Promise<void> {
      env = environment;
      return readToken(env, env.ownerEmail).then(function keepToken(accessToken: string): void {
        token = accessToken;
      });
    })
    .then(createTrainer)
    .then(readStarterCreature);
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

function readStarterCreature(): Promise<void> {
  const query = env.admin.from('creatures').select('id').eq('trainer_id', trainerId);
  return Promise.resolve(query.then(readStarterRows)).then(function keep(id: string): void {
    starterCreatureId = id;
  });
}

function readStarterRows(result: {
  data: { id: string }[] | null;
  error: { message: string } | null;
}): string {
  const first = (result.data ?? [])[0];
  if (first === undefined) {
    throw new Error(`the starter creature is missing: ${result.error?.message ?? 'no rows'}`);
  }
  return first.id;
}

function startsWithTheLoadout(): Promise<void> {
  return readSpeciesAbilities(env).then(function assertAbilities(
    abilities: AbilityPayload[],
  ): Promise<void> {
    // The species declares six abilities, but the creature is born with the
    // four player slots: the species slots 4 and 5 are options for the loadout,
    // not part of the loadout it starts with.
    const playerAbilities = abilities.filter(function inPlayerSlot(
      ability: AbilityPayload,
    ): boolean {
      return ability.slot < 4;
    });
    return readState(env, token).then(function assertState(state: PlayerStatePayload): void {
      expect(state.equippedAbilities).toHaveLength(playerAbilities.length);
      expect(state.equippedAbilities.map(readSlot)).toEqual(playerAbilities.map(readSlot));
      expect(state.equippedAbilities[0]?.abilityId).toBe(playerAbilities[0]?.ability_id);
    });
  });
}

function showsTheLifeOfTheCreature(): Promise<void> {
  return readState(env, token).then(function assertState(state: PlayerStatePayload): void {
    expect(state.activeVitals).not.toBeNull();
    expect(state.activeVitals?.maxHp).toBe(22);
    expect(state.activeVitals?.currentHp).toBe(22);
  });
}

function equipsAbilities(): Promise<void> {
  return readSpeciesAbilities(env).then(function writeAbilities(
    abilities: AbilityPayload[],
  ): Promise<void> {
    const first = abilities[0];
    const third = abilities[2];
    if (first === undefined || third === undefined) {
      throw new Error('the species has less than three abilities');
    }
    // The loadout travels as the four slots, and an empty slot is an empty
    // string: the first and the third abilities go to the second and to the
    // fourth slot.
    const abilityIds = ['', first.ability_id, '', third.ability_id];
    return sendJson(
      env,
      'PUT',
      `/api/creatures/${starterCreatureId}/ability-slots`,
      { abilityIds },
      token,
    ).then(function assertStatus(response: Response): Promise<void> {
      expect(response.status).toBe(NO_CONTENT);
      return readState(env, token).then(function assertState(state: PlayerStatePayload): void {
        expect(state.equippedAbilities.map(readEquippedAbilityId)).toEqual([
          first.ability_id,
          third.ability_id,
        ]);
        expect(state.equippedAbilities.map(readSlot)).toEqual([1, 3]);
      });
    });
  });
}

function refusesForeignAbility(): Promise<void> {
  return sendJson(
    env,
    'PUT',
    `/api/creatures/${starterCreatureId}/ability-slots`,
    { abilityIds: [FOREIGN_ABILITY_ID] },
    token,
  ).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(BAD_REQUEST);
    return response.json().then(function assertCode(body: unknown): void {
      expect((body as { error: string }).error).toBe('invalid_team_command');
    });
  });
}

function refusesRepeatedAbility(): Promise<void> {
  return readSpeciesAbilities(env).then(function assertStatus(
    abilities: AbilityPayload[],
  ): Promise<void> {
    const first = abilities[0];
    if (first === undefined) {
      throw new Error('the species has no ability');
    }
    return sendJson(
      env,
      'PUT',
      `/api/creatures/${starterCreatureId}/ability-slots`,
      { abilityIds: ['', first.ability_id, '', first.ability_id] },
      token,
    ).then(function readResponse(response: Response): void {
      expect(response.status).toBe(BAD_REQUEST);
    });
  });
}

function equipsConsumable(): Promise<void> {
  return readItem(env, 'consumable').then(function writeConsumable(
    item: ItemPayload,
  ): Promise<void> {
    return sendJson(
      env,
      'PUT',
      '/api/gear-slots/4',
      { itemId: item.id, triggerHpPercent: 30 },
      token,
    ).then(function assertStatus(response: Response): Promise<void> {
      expect(response.status).toBe(NO_CONTENT);
      return giveItem(env, trainerId, item, 5).then(function assertState(): Promise<void> {
        return readState(env, token).then(function readGear(state: PlayerStatePayload): void {
          expect(state.equippedConsumables).toHaveLength(1);
          expect(state.equippedConsumables[0]?.itemId).toBe(item.id);
          expect(state.equippedConsumables[0]?.name).toBe(item.name);
          expect(state.equippedConsumables[0]?.quantity).toBe(5);
          expect(state.equippedConsumables[0]?.triggerHpPercent).toBe(30);
          expect(state.equippedConsumables[0]?.slot).toBe(4);
        });
      });
    });
  });
}

function equipsDevice(): Promise<void> {
  return readItem(env, 'device').then(function writeDevice(item: ItemPayload): Promise<void> {
    return sendJson(env, 'PUT', '/api/gear-slots/6', { itemId: item.id }, token).then(
      function assertStatus(response: Response): Promise<void> {
        expect(response.status).toBe(NO_CONTENT);
        return giveItem(env, trainerId, item, 2).then(function assertState(): Promise<void> {
          return readState(env, token).then(function readGear(state: PlayerStatePayload): void {
            expect(state.equippedDevice?.itemId).toBe(item.id);
            expect(state.equippedDevice?.name).toBe(item.name);
            expect(state.equippedDevice?.slot).toBe(6);
            expect(state.equippedDevice?.quantity).toBe(2);
          });
        });
      },
    );
  });
}

function emptiesTheSlot(): Promise<void> {
  return sendRequest(env, 'DELETE', '/api/gear-slots/4', token).then(function assertStatus(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(NO_CONTENT);
    return readState(env, token).then(function assertState(state: PlayerStatePayload): void {
      expect(state.equippedConsumables).toHaveLength(0);
    });
  });
}

function leavesEmptyDatabase(): Promise<void> {
  let trainerIds: string[] = [];
  const ownTrainers = env.admin.from('trainers').select('id').eq('owner_id', env.ownerId);
  return Promise.resolve(ownTrainers.then(readRows))
    .then(function collect(result: RowResult): PromiseLike<RowResult> {
      trainerIds = (result.data ?? []).map(readId);
      const deletion = env.admin.from('trainers').delete().eq('owner_id', env.ownerId);
      return deletion.then(readRows);
    })
    .then(function assertTrainers(): PromiseLike<RowResult> {
      const remaining = env.admin.from('trainers').select('id').eq('owner_id', env.ownerId);
      return remaining.then(readRows);
    })
    .then(function assertOwnTrainers(result: RowResult): PromiseLike<RowResult> {
      expect(countRows(result)).toBe(0);
      const creatures = env.admin.from('creatures').select('id').in('trainer_id', trainerIds);
      return creatures.then(readRows);
    })
    .then(function assertCreatures(result: RowResult): PromiseLike<RowResult> {
      expect(countRows(result)).toBe(0);
      const slots = env.admin
        .from('trainer_gear_slots')
        .select('slot')
        .in('trainer_id', trainerIds);
      return slots.then(readRows);
    })
    .then(function assertSlots(result: RowResult): void {
      expect(countRows(result)).toBe(0);
    });
}
