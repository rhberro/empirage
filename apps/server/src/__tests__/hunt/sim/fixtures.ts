import type { HuntMap, HuntMapSpawn } from '@creatures/contracts/huntMap';
import { TILE } from '@creatures/contracts/world';
import type { Tile } from '@creatures/contracts/world';

import { createHuntState } from '~/hunt/sim/create';
import type { CreateHuntStateInput } from '~/hunt/sim/create';
import { createCreatureFromSpecies } from '~/hunt/sim/stats';
import type {
  SimAbility,
  SimAttributeSet,
  SimContent,
  SimCreature,
  SimSpecies,
  SimState,
  SimTeamMemberInput,
} from '~/hunt/sim/types';

export const START = Date.parse('2026-10-23T12:00:00.000Z');

export const ABILITY_A: SimAbility = {
  areaLength: null,
  areaRadius: null,
  areaShape: null,
  areaStepMs: 0,
  cooldownMs: 4000,
  damage: 10,
  element: 'neutral',
  name: 'A',
  range: 5,
  slug: 'a',
  targetType: 'target',
  travelMs: 0,
};

export const ABILITY_B: SimAbility = {
  ...ABILITY_A,
  cooldownMs: 2000,
  name: 'B',
  slug: 'b',
};

export const ABILITY_C: SimAbility = {
  ...ABILITY_A,
  cooldownMs: 2000,
  name: 'C',
  slug: 'c',
};

export const ABILITY_D: SimAbility = {
  ...ABILITY_A,
  cooldownMs: 1000,
  name: 'D',
  slug: 'd',
};

export const LINE_ABILITY: SimAbility = {
  areaLength: 4,
  areaRadius: null,
  areaShape: 'line',
  areaStepMs: 200,
  cooldownMs: 5000,
  damage: 40,
  element: 'fire',
  name: 'Line',
  range: 5,
  slug: 'line',
  targetType: 'area',
  travelMs: 0,
};

export const BRASA: SimSpecies = {
  abilities: [],
  base: {
    magicAttack: 30,
    magicDefense: 20,
    physicalAttack: 20,
    physicalDefense: 10,
    vitality: 100,
  },
  baseExperience: 100,
  captureChance: 0.05,
  drops: [{ chance: 1, itemId: 'ember', name: 'Ember' }],
  element: 'fire',
  name: 'Brasa',
  slug: 'brasa',
};

export const BROTO: SimSpecies = {
  abilities: [],
  base: {
    magicAttack: 20,
    magicDefense: 20,
    physicalAttack: 20,
    physicalDefense: 10,
    vitality: 100,
  },
  baseExperience: 50,
  captureChance: 0.05,
  drops: [{ chance: 0, itemId: 'leaf', name: 'Leaf' }],
  element: 'plant',
  name: 'Broto',
  slug: 'broto',
};

export type FixtureContentOptions = {
  loop?: Tile[];
  spawn?: Tile;
  spawns?: HuntMapSpawn[];
  species?: Record<string, SimSpecies>;
};

/**
 * A twenty by twenty meadow with a dense rectangular loop: the border is a
 * wall of trees and the interior is grass, so the only walls are the ones the
 * simulation itself puts in the tests.
 */
export function buildMap(options?: FixtureContentOptions): HuntMap {
  const loop = options?.loop ?? buildLoop();
  const spawn = options?.spawn ?? { x: 5, y: 5 };
  const spawns = options?.spawns ?? [
    { level: 1, respawnMs: 5000, species: 'brasa', x: 8, y: 7 },
    { level: 1, respawnMs: 5000, species: 'broto', x: 12, y: 8 },
  ];
  const tiles: HuntMap['tiles'] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const border = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
      tiles.push(border ? TILE.TREE : TILE.GRASS);
    }
  }
  return {
    height: MAP_HEIGHT,
    loop,
    name: 'Test Meadow',
    slug: 'test-meadow',
    spawn,
    spawns,
    tiles,
    width: MAP_WIDTH,
  };
}

export function buildContent(options?: FixtureContentOptions): SimContent {
  return {
    effectiveness: { 'fire:plant': 1.5 },
    map: buildMap(options),
    species: options?.species ?? { brasa: BRASA, broto: BROTO },
  };
}

export function buildLoop(): Tile[] {
  const loop: Tile[] = [];
  for (let x = 5; x <= 14; x += 1) {
    loop.push({ x, y: 5 });
  }
  for (let y = 6; y <= 10; y += 1) {
    loop.push({ x: 14, y });
  }
  for (let x = 13; x >= 5; x -= 1) {
    loop.push({ x, y: 10 });
  }
  for (let y = 9; y >= 6; y -= 1) {
    loop.push({ x: 5, y });
  }
  return loop;
}

export function neutralPotential(): SimAttributeSet {
  return {
    magicAttack: 50,
    magicDefense: 50,
    physicalAttack: 50,
    physicalDefense: 50,
    vitality: 50,
  };
}

export function buildTeamMember(overrides?: Partial<SimTeamMemberInput>): SimTeamMemberInput {
  const base: SimTeamMemberInput = {
    abilities: [null, null, null, null],
    consumables: [],
    creatureId: 'creature-1',
    currentHp: null,
    experience: 0,
    level: 1,
    potential: neutralPotential(),
    speciesSlug: 'brasa',
    teamSlot: 1,
  };
  return { ...base, ...overrides };
}

export function buildState(overrides?: Partial<CreateHuntStateInput>): SimState {
  const base: CreateHuntStateInput = {
    areaSlug: 'test-area',
    content: buildContent(),
    endsAt: START + 60_000,
    seed: 1234,
    startedAt: START,
    team: [buildTeamMember()],
  };
  return createHuntState({ ...base, ...overrides });
}

/**
 * A wild that does not decide on its own until the test says so.
 */
export function buildWild(
  content: SimContent,
  tile: Tile,
  speciesSlug: string,
  id: string,
): SimCreature {
  const species = content.species[speciesSlug] ?? BRASA;
  const wild = createCreatureFromSpecies({
    behavior: 'idle',
    dir: 'down',
    hp: null,
    id,
    kind: 'wild',
    level: 1,
    potential: neutralPotential(),
    species,
    tile,
  });
  wild.abilityReadyAt = [null, null, null, null];
  wild.consumableReadyAt = [];
  wild.meleeReadyAt = START;
  wild.nextAbilityAt = START;
  wild.nextDecisionAt = START + 1_000_000_000;
  wild.spawnIndex = 0;
  wild.spawnTile = { x: tile.x, y: tile.y };
  wild.trail = [{ x: tile.x, y: tile.y }];
  wild.wildReadyAt = {};
  return wild;
}

const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;
