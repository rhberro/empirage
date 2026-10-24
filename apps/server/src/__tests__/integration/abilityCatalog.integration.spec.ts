import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { NO_CONTENT } from '~/__tests__/support';

import { cleanupEnvironment, prepareEnvironment, readToken } from './environment';
import type { IntegrationEnvironment } from './environment';
import { createTrainerWithSession, readState, sendJson } from './teamSupport';
import type { PlayerStatePayload } from './teamSupport';

const ENABLED = globalThis.process.env.CREATURES_TEST_DB === '1';
const EXPECTED_SPECIES = 5;
const ABILITIES_PER_SPECIES = 6;
const PLAYER_SLOTS = [0, 1, 2, 3];
const TARGET_TYPES = ['target', 'area', 'area_self'];
const LOADOUT_SLUGS = ['brasa', 'garra', 'ignea', 'explosao'];

type CatalogAbility = {
  id: string;
  slug: string;
};

type EmbeddedAbility = {
  slug: string;
  target_type: string;
};

type SpeciesAbility = {
  abilities: EmbeddedAbility | EmbeddedAbility[] | null;
  slot: number;
  species_id: string;
};

type RowsResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

let env: IntegrationEnvironment;
let token = '';
let trainerId = '';
let creatureId = '';

describe.skipIf(!ENABLED)('the 2.2 ability catalog against the real database', describeCatalog);

function describeCatalog(): void {
  beforeAll(prepareSuite);
  afterAll(cleanupSuite);

  test('every species declares six abilities, two of each kind', listsTheCatalog);
  // The first request of a cold run pays for the session and the loadout
  // refresh, which can pass the five second default of the runner.
  test(
    'the player equips four abilities, including one centred on the caster',
    equipsTheLoadout,
    15000,
  );
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
  return createTrainerWithSession(env, token).then(function keep(id: string): void {
    trainerId = id;
  });
}

function readStarterCreature(): Promise<void> {
  const query = env.admin.from('creatures').select('id').eq('trainer_id', trainerId);
  return Promise.resolve(query).then(function keep(result: RowsResult<{ id: string }>): void {
    if (result.error !== null) {
      throw new Error(`the starter creature read failed: ${result.error.message}`);
    }
    const first = (result.data ?? [])[0];
    if (first === undefined) {
      throw new Error('the starter creature is missing');
    }
    creatureId = first.id;
  });
}

function listsTheCatalog(): Promise<void> {
  return Promise.all([readSpeciesCount(), readSpeciesAbilities()]).then(function assert(
    reads: [number, SpeciesAbility[]],
  ): void {
    const [speciesCount, rows] = reads;
    expect(speciesCount).toBe(EXPECTED_SPECIES);
    expect(rows).toHaveLength(EXPECTED_SPECIES * ABILITIES_PER_SPECIES);
    const bySpecies = groupBySpecies(rows);
    expect(bySpecies.size).toBe(EXPECTED_SPECIES);
    for (const abilities of bySpecies.values()) {
      expect(abilities.map(readSlot)).toEqual([0, 1, 2, 3, 4, 5]);
      for (const type of TARGET_TYPES) {
        expect(abilities.filter(matchesType(type))).toHaveLength(2);
      }
    }
  });
}

function equipsTheLoadout(): Promise<void> {
  return readLoadoutIds().then(function write(ids: string[]): Promise<void> {
    const path = `/api/creatures/${creatureId}/ability-slots`;
    return sendJson(env, 'PUT', path, { abilityIds: ids }, token).then(function assert(
      response: Response,
    ): Promise<void> {
      expect(response.status).toBe(NO_CONTENT);
      return readState(env, token).then(function assertState(state: PlayerStatePayload): void {
        expect(state.equippedAbilities).toHaveLength(PLAYER_SLOTS.length);
        expect(state.equippedAbilities.map(readEquippedAbilityId)).toEqual(ids);
        expect(state.equippedAbilities.map(readEquippedSlot)).toEqual(PLAYER_SLOTS);
      });
    });
  });
}

function readSpeciesCount(): Promise<number> {
  const query = env.admin.from('species').select('id');
  return Promise.resolve(query).then(function count(result: RowsResult<{ id: string }>): number {
    if (result.error !== null) {
      throw new Error(`the species read failed: ${result.error.message}`);
    }
    return (result.data ?? []).length;
  });
}

function readSpeciesAbilities(): Promise<SpeciesAbility[]> {
  const query = env.admin
    .from('species_abilities')
    .select('species_id, slot, abilities(slug, target_type)')
    .order('slot');
  return Promise.resolve(query).then(function readRows(
    result: RowsResult<SpeciesAbility>,
  ): SpeciesAbility[] {
    if (result.error !== null) {
      throw new Error(`the species abilities read failed: ${result.error.message}`);
    }
    return result.data ?? [];
  });
}

function groupBySpecies(rows: SpeciesAbility[]): Map<string, SpeciesAbility[]> {
  const groups = new Map<string, SpeciesAbility[]>();
  for (const row of rows) {
    const group = groups.get(row.species_id) ?? [];
    group.push(row);
    groups.set(row.species_id, group);
  }
  for (const group of groups.values()) {
    group.sort(bySlot);
  }
  return groups;
}

function bySlot(left: SpeciesAbility, right: SpeciesAbility): number {
  return left.slot - right.slot;
}

function readSlot(row: SpeciesAbility): number {
  return row.slot;
}

function matchesType(type: string): (row: SpeciesAbility) => boolean {
  return function hasType(row: SpeciesAbility): boolean {
    return readEmbeddedAbility(row).target_type === type;
  };
}

function readEmbeddedAbility(row: SpeciesAbility): EmbeddedAbility {
  const { abilities } = row;
  if (abilities === null) {
    throw new Error('the ability of the species is missing');
  }
  return Array.isArray(abilities) ? (abilities[0] ?? { slug: '', target_type: '' }) : abilities;
}

function readLoadoutIds(): Promise<string[]> {
  const query = env.admin.from('abilities').select('id, slug').in('slug', LOADOUT_SLUGS);
  return Promise.resolve(query).then(function order(result: RowsResult<CatalogAbility>): string[] {
    if (result.error !== null) {
      throw new Error(`the ability catalog read failed: ${result.error.message}`);
    }
    const bySlug = new Map<string, string>();
    for (const row of result.data ?? []) {
      bySlug.set(row.slug, row.id);
    }
    return LOADOUT_SLUGS.map(function pick(slug: string): string {
      const id = bySlug.get(slug);
      if (id === undefined) {
        throw new Error(`the ability ${slug} is missing`);
      }
      return id;
    });
  });
}

function readEquippedAbilityId(ability: { abilityId: string }): string {
  return ability.abilityId;
}

function readEquippedSlot(ability: { slot: number }): number {
  return ability.slot;
}
