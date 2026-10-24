import type { HuntMap } from '@creatures/contracts/huntMap';
import type { Tile } from '@creatures/contracts/world';

import { createCreatureFromSpecies } from '~/hunt/sim/stats';
import type { SimContent, SimCreature, SimState } from '~/hunt/sim/types';
import { activeCreature, isAlive, sameTile } from '~/hunt/sim/types';

/** The interval between two decisions of a wild. */
export const WILD_DECISION_MS = 1000;

/** How far the active creature looks for a wild to attack. */
export const TARGET_ACQUIRE_RANGE = 7;

/** How far a wild is kept as a target before the chase is given up. */
export const TARGET_LOST_RANGE = 9;

/** How long a taken spawn waits before trying again. */
export const RESPAWN_RETRY_MS = 1000;

/** The potential of every wild: neutral, so the base values are untouched. */
const NEUTRAL_POTENTIAL = {
  magicAttack: 50,
  magicDefense: 50,
  physicalAttack: 50,
  physicalDefense: 50,
  vitality: 50,
};

/**
 * Builds one wild from the spawn definition of the area.
 */
export function createWild(
  content: SimContent,
  spawnIndex: number,
  now: number,
  nextDecisionAt: number,
): SimCreature | null {
  const definition = content.map.spawns[spawnIndex];
  if (definition === undefined) {
    return null;
  }
  const species = content.species[definition.species];
  if (species === undefined) {
    return null;
  }
  const tile = { x: definition.x, y: definition.y };
  return {
    ...createCreatureFromSpecies({
      behavior: 'idle',
      dir: 'down',
      hp: null,
      id: `wild-${spawnIndex}-${now}`,
      kind: 'wild',
      level: definition.level,
      potential: NEUTRAL_POTENTIAL,
      species,
      tile,
    }),
    abilityReadyAt: [null, null, null, null],
    consumableReadyAt: [],
    meleeReadyAt: now,
    nextAbilityAt: now,
    nextDecisionAt,
    spawnIndex,
    spawnTile: cloneTile(tile),
    trail: [cloneTile(tile)],
    wildReadyAt: {},
  };
}

/**
 * The wilds in the stable order of their spawn.
 */
export function readOrderedWilds(state: SimState): SimCreature[] {
  const ordered = [...state.wilds];
  ordered.sort(compareWilds);
  return ordered;
}

export function compareWilds(left: SimCreature, right: SimCreature): number {
  return (left.spawnIndex ?? 0) - (right.spawnIndex ?? 0);
}

export function readRespawnMs(content: SimContent, index: number): number {
  return content.map.spawns[index]?.respawnMs ?? RESPAWN_RETRY_MS;
}

export function isOccupied(state: SimState, tile: Tile): boolean {
  if (occupies(state.trainer, tile)) {
    return true;
  }
  if (occupies(activeCreature(state), tile)) {
    return true;
  }
  for (const wild of state.wilds) {
    if (isAlive(wild) && occupies(wild, tile)) {
      return true;
    }
  }
  return false;
}

export function occupies(actor: SimMoverLike, tile: Tile): boolean {
  if (sameTile(actor.tile, tile)) {
    return true;
  }
  return actor.segment !== undefined && sameTile(actor.segment.to, tile);
}

export type SimMoverLike = {
  segment?: { to: Tile };
  tile: Tile;
};

export function cloneTile(tile: Tile): Tile {
  return { x: tile.x, y: tile.y };
}

export function readLoopIndex(map: HuntMap, spawn: Tile): number {
  for (let index = 0; index < map.loop.length; index += 1) {
    const node = map.loop[index];
    if (node !== undefined && sameTile(node, spawn)) {
      return index;
    }
  }
  return 0;
}
