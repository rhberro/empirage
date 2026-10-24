import { expect } from 'bun:test';

import type { HuntDelta, HuntEndedMessage, HuntSnapshot } from '@creatures/contracts/huntSim';
import type { SupabaseClient } from '@supabase/supabase-js';

import { buildTeamMember } from '~/__tests__/hunt/sim/fixtures';
import { loadHuntAreaContent } from '~/hunt/content';
import type { HuntStartErrorCode } from '~/hunt/errors';
import { HuntStartError } from '~/hunt/errors';
import { createHuntManager } from '~/hunt/runtime/manager';
import type { HuntManager } from '~/hunt/runtime/types';
import { readActiveHuntSession } from '~/hunt/session';
import type { SimContent, SimState, SimTeamMemberInput } from '~/hunt/sim';
import { createHuntState } from '~/hunt/sim';

import type { FakeDatabase, FakeRow } from './fakeHuntAdmin';
import { buildHuntAdmin, findRow } from './fakeHuntAdmin';

export const START = Date.parse('2026-10-23T12:00:00.000Z');
export const ACCOUNT_ID = 'account-1';
export const AREA_ID = 'area-1';
export const TRAINER_ID = 'trainer-1';
export const CREATURE_ID = 'creature-1';
export const ABILITY_ID = 'ability-1';
export const EMBER_ID = 'ember-item';
export const POTION_ID = 'potion-item';

const BRASA_ID = 'species-brasa';
const BROTO_ID = 'species-broto';
const CINZARRA_ID = 'species-cinzarra';
const GOTA_ID = 'species-gota';
const PEDRINO_ID = 'species-pedrino';

const SPECIES_ROWS: FakeRow[] = [
  buildSpecies(BRASA_ID, 'brasa', 'Brasa', 'fire'),
  buildSpecies(BROTO_ID, 'broto', 'Broto', 'plant'),
  buildSpecies(CINZARRA_ID, 'cinzarra', 'Cinzarra', 'fire'),
  buildSpecies(GOTA_ID, 'gota', 'Gota', 'water'),
  buildSpecies(PEDRINO_ID, 'pedrino', 'Pedrino', 'neutral'),
];

const AREA_SPECIES: FakeRow[] = [
  { hunt_area_id: AREA_ID, is_primary: true, position: 0, species_id: BRASA_ID },
  { hunt_area_id: AREA_ID, is_primary: false, position: 1, species_id: BROTO_ID },
  { hunt_area_id: AREA_ID, is_primary: false, position: 2, species_id: PEDRINO_ID },
  { hunt_area_id: AREA_ID, is_primary: false, position: 3, species_id: CINZARRA_ID },
];

export type SeedOptions = {
  creatures?: FakeRow[];
  minimumLevel?: number;
  trainerItems?: FakeRow[];
  trainerLevel?: number;
  trainerStamina?: number;
};

export type Harness = {
  admin: SupabaseClient;
  advanceClock: (milliseconds: number) => void;
  clock: { value: number };
  db: FakeDatabase;
  deltas: HuntDelta[];
  ended: HuntEndedMessage[];
  manager: HuntManager;
};

export function buildHarness(options?: SeedOptions): Harness {
  const seed = buildSeed(options ?? {});
  const fake = buildHuntAdmin(seed);
  const clock = { value: START };
  const deltas: HuntDelta[] = [];
  const ended: HuntEndedMessage[] = [];
  const manager = createHuntManager({
    admin: fake.admin,
    now: function now(): number {
      return clock.value;
    },
    onDelta: function onDelta(_accountId: string, _trainerId: string, delta: HuntDelta): void {
      deltas.push(delta);
    },
    onEnded: function onEnded(
      _accountId: string,
      _trainerId: string,
      message: HuntEndedMessage,
    ): void {
      ended.push(message);
    },
  });
  function advanceClock(milliseconds: number): void {
    clock.value += milliseconds;
  }
  return { admin: fake.admin, advanceClock, clock, db: fake.db, deltas, ended, manager };
}

export function buildSessionRow(state: SimState, overrides?: Partial<FakeRow>): FakeRow {
  return {
    account_id: ACCOUNT_ID,
    actions: [],
    encounters: 0,
    end_reason: null,
    ended_at: null,
    hunt_area_id: AREA_ID,
    id: 'session-1',
    kills: 0,
    last_simulated_at: new Date(START).toISOString(),
    rng_draws: state.rng.draws,
    rng_seed: state.rng.seed,
    simulation_state: state,
    stamina_at_start: 480,
    stamina_spent_minutes: 0,
    started_at: new Date(START).toISOString(),
    status: 'active',
    trainer_id: TRAINER_ID,
    ...overrides,
  };
}

export function hydrateStoredState(harness: Harness): Promise<void> {
  return readActiveHuntSession(harness.admin, TRAINER_ID).then(function withSession(
    session: Awaited<ReturnType<typeof readActiveHuntSession>>,
  ): Promise<void> {
    if (session === null) {
      throw new Error('the session of the fixture was not found');
    }
    return harness.manager.hydrate(session);
  });
}

export function buildSeed(options: SeedOptions): Record<string, FakeRow[]> {
  const creatures = options.creatures ?? [buildCreature()];
  return {
    creature_ability_slots: [buildEquippedAbility()],
    creatures,
    hunt_area_species: AREA_SPECIES,
    hunt_areas: [
      {
        id: AREA_ID,
        minimum_level: options.minimumLevel ?? 1,
        name: 'Campina Cinzenta',
        recommended_level: 2,
        slug: 'campina-cinzenta',
      },
    ],
    hunt_sessions: [],
    items: [buildItem(EMBER_ID, 'Ember', null), buildItem(POTION_ID, 'Poção', 50)],
    species: SPECIES_ROWS,
    species_abilities: [],
    species_drops: [BRASA_ID, BROTO_ID, CINZARRA_ID, GOTA_ID, PEDRINO_ID].map(function dropFor(
      speciesId: string,
    ): FakeRow {
      return { chance: 1, items: { id: EMBER_ID, name: 'Ember' }, species_id: speciesId };
    }),
    trainer_gear_slots: [
      {
        item_id: POTION_ID,
        items: { cooldown_ms: 2000, heal_percent: 50, id: POTION_ID, name: 'Poção' },
        kind: 'consumable',
        slot: 4,
        trainer_id: TRAINER_ID,
        trigger_hp_percent: 50,
      },
    ],
    trainer_items: options.trainerItems ?? [],
    trainers: [
      {
        id: TRAINER_ID,
        level: options.trainerLevel ?? 10,
        stamina_minutes: options.trainerStamina ?? 480,
      },
    ],
    type_effectiveness: [{ attacker_element: 'fire', defender_element: 'plant', multiplier: 1.5 }],
  };
}

function buildCreature(): FakeRow {
  return {
    current_hp: null,
    experience: 0,
    id: CREATURE_ID,
    is_in_team: true,
    level: 5,
    potential: { magicAttack: 50, physicalAttack: 50, vitality: 50 },
    species: buildSpecies(BRASA_ID, 'brasa', 'Brasa', 'fire'),
    team_slot: 1,
    trainer_id: TRAINER_ID,
  };
}

function buildSpecies(id: string, slug: string, name: string, element: string): FakeRow {
  return {
    base_experience: 100,
    base_magic_attack: 4,
    base_magic_defense: 2,
    base_physical_attack: 8,
    base_physical_defense: 7,
    base_vitality: 22,
    capture_chance: 0.05,
    element,
    id,
    name,
    slug,
  };
}

function buildEquippedAbility(): FakeRow {
  return {
    abilities: {
      area_length: null,
      area_radius: null,
      area_shape: null,
      area_step_ms: 150,
      cooldown_ms: 4000,
      damage: 999,
      element: 'fire',
      id: ABILITY_ID,
      name: 'Brasa',
      range: 5,
      slug: 'brasa',
      target_type: 'target',
      travel_ms: 0,
    },
    creature_id: CREATURE_ID,
    slot: 0,
  };
}

function buildItem(id: string, name: string, healPercent: number | null): FakeRow {
  return { capture_multiplier: 1, cooldown_ms: 2000, heal_percent: healPercent, id, name };
}

export type Field = {
  content: SimContent;
  state: SimState;
};

export function startHunt(harness: Harness): Promise<HuntSnapshot> {
  return harness.manager.start({
    accountId: ACCOUNT_ID,
    areaId: AREA_ID,
    trainerId: TRAINER_ID,
  });
}

export function expectStartError(
  promise: Promise<unknown>,
  code: HuntStartErrorCode,
): Promise<void> {
  return promise.then(
    function unexpected(): void {
      throw new Error(`the start was expected to fail with ${code}`);
    },
    function assert(error: unknown): void {
      expect(error).toBeInstanceOf(HuntStartError);
      expect((error as HuntStartError).code).toBe(code);
    },
  );
}

export function buildField(harness: Harness, team?: SimTeamMemberInput[]): Promise<Field> {
  return loadHuntAreaContent(harness.admin, AREA_ID, ['brasa']).then(function withArea(
    area: Awaited<ReturnType<typeof loadHuntAreaContent>>,
  ): Field {
    const state = createHuntState({
      areaSlug: area.areaSlug,
      content: area.content,
      endsAt: START + 60_000,
      seed: 42,
      startedAt: START,
      team: team ?? [buildTeamMember({ abilities: [null, null, null, null] })],
    });
    return { content: area.content, state };
  });
}

export function seedCreatureHp(harness: Harness, creatureId: string, hp: number | null): void {
  const row = findRow(harness.db, 'creatures', 'id', creatureId);
  if (row === undefined) {
    throw new Error(`the creature ${creatureId} was not found`);
  }
  row.current_hp = hp;
}

export function addStorageCreature(harness: Harness, creatureId: string, hp: number): void {
  const rows = harness.db.rows.get('creatures') ?? [];
  rows.push({
    current_hp: hp,
    experience: 0,
    id: creatureId,
    is_in_team: false,
    level: 1,
    team_slot: null,
    trainer_id: TRAINER_ID,
  });
  harness.db.rows.set('creatures', rows);
}

export function readCreatureHp(harness: Harness, creatureId: string): number | null {
  const row = findRow(harness.db, 'creatures', 'id', creatureId);
  return row === undefined ? null : (row.current_hp as number | null);
}
