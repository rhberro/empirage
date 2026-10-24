import type { HuntMap } from '@creatures/contracts/huntMap';
import type { HuntLedger } from '@creatures/contracts/huntSim';
import type { Tile } from '@creatures/contracts/world';

import { drawInt } from '~/hunt/rng';
import type { HuntRandomState } from '~/hunt/rng';
import { directionBetween, tileKey } from '~/hunt/sim/geometry';
import { createCreatureFromSpecies } from '~/hunt/sim/stats';
import type {
  SimAbility,
  SimConsumable,
  SimContent,
  SimDevice,
  SimState,
  SimTeamMember,
  SimTeamMemberInput,
  SimTrainer,
} from '~/hunt/sim/types';
import { activeCreature, isAlive, sameTile } from '~/hunt/sim/types';
import { cloneTile, createWild, readLoopIndex, WILD_DECISION_MS } from '~/hunt/sim/world';

/**
 * What is needed to open a hunt.
 *
 * The end of the window and the seed come from outside: the runner owns the
 * stamina and the offline session, and the seed is drawn once when the session
 * begins.
 */
export type CreateHuntStateInput = {
  areaSlug: string;
  content: SimContent;
  device?: SimDevice | null;
  endsAt: number;
  rngDraws?: number;
  seed: number;
  startedAt: number;
  team: SimTeamMemberInput[];
};

/**
 * Builds the initial state of a hunt.
 *
 * No loot and no experience are drawn here: the state begins with a full team,
 * one wild per spawn and a random cursor that only advanced to stagger the
 * first decision of each wild, in the order of the spawns.
 */
export function createHuntState(input: CreateHuntStateInput): SimState {
  const { areaSlug, content, device, endsAt, seed, startedAt, team } = input;
  if (team.length === 0) {
    throw new Error('a hunt needs at least one creature');
  }
  const map = content.map;
  const spawn = cloneTile(map.spawn);
  const loopIndex = readLoopIndex(map, spawn);
  const trainerTile = readTrainerTile(map, loopIndex, spawn);
  const rng: HuntRandomState = { draws: input.rngDraws ?? 0, seed };
  const members = buildTeam(team, content, spawn, startedAt, loopIndex);
  const state: SimState = {
    activeCreatureId: readFirstAliveId(members),
    areaSlug,
    device: device === undefined || device === null ? null : { ...device },
    endReason: null,
    ended: false,
    endsAt,
    lastSwapAt: 0,
    ledger: createEmptyLedger(),
    loopIndex,
    nextWaveId: 0,
    projectiles: [],
    rng,
    simulatedAt: startedAt,
    spawns: [],
    team: members,
    trainer: createTrainer(trainerTile, spawn),
    waves: [],
    wilds: [],
  };
  if (!isAlive(activeCreature(state))) {
    state.ended = true;
    state.endReason = 'no_viable_creature';
    state.endsAt = startedAt;
    return state;
  }
  populateWilds(state, content, startedAt);
  return state;
}

/**
 * Creates one wild per spawn, rejecting a content whose spawns stack actors.
 *
 * The player and the trainer are already placed, so a wild spawn over either
 * of them can never be honored; that is a content error, not a busy tile.
 */
function populateWilds(state: SimState, content: SimContent, startedAt: number): void {
  const map = content.map;
  const occupied = new Set<string>([
    tileKey(state.trainer.tile),
    tileKey(activeCreature(state).tile),
  ]);
  for (let index = 0; index < map.spawns.length; index += 1) {
    const definition = map.spawns[index];
    if (definition !== undefined) {
      const key = tileKey({ x: definition.x, y: definition.y });
      if (occupied.has(key)) {
        throw new Error(
          `hunt content ${state.areaSlug}: wild spawn ${index} overlaps an actor at ${definition.x},${definition.y}`,
        );
      }
      occupied.add(key);
    }
    const decision = drawInt(state.rng, WILD_DECISION_MS);
    state.rng = decision.state;
    const wild = createWild(content, index, startedAt, startedAt + decision.value);
    if (wild === null) {
      continue;
    }
    state.wilds.push(wild);
    state.spawns.push({ index, respawnAt: null, wildId: wild.id });
  }
}

function buildTeam(
  configs: SimTeamMemberInput[],
  content: SimContent,
  tile: Tile,
  startedAt: number,
  loopIndex: number,
): SimTeamMember[] {
  const members: SimTeamMember[] = [];
  for (let index = 0; index < configs.length; index += 1) {
    const config = configs[index];
    const species = content.species[config.speciesSlug];
    if (species === undefined) {
      throw new Error(`unknown species ${config.speciesSlug}`);
    }
    const creature = createCreatureFromSpecies({
      behavior: 'loop',
      dir: 'down',
      hp: config.currentHp,
      id: config.creatureId,
      kind: 'player',
      level: config.level,
      potential: config.potential,
      species,
      tile,
    });
    const abilities = normalizeAbilities(config.abilities);
    const consumables = cloneConsumables(config.consumables);
    const member: SimTeamMember = {
      ...creature,
      abilities,
      abilityReadyAt: readAbilityReadyAt(abilities, startedAt),
      consumableReadyAt: readConsumableReadyAt(consumables.length, startedAt),
      consumables,
      creatureId: config.creatureId,
      experience: config.experience,
      loopIndex,
      potential: config.potential,
      teamSlot: config.teamSlot ?? index + 1,
    };
    members.push(member);
  }
  return members;
}

type SimAbilityOrNull = SimAbility | null;

function normalizeAbilities(abilities: (SimAbility | null)[]): SimAbilityOrNull[] {
  const normalized: SimAbilityOrNull[] = [];
  for (let slot = 0; slot < 4; slot += 1) {
    normalized.push(abilities[slot] ?? null);
  }
  return normalized;
}

function readAbilityReadyAt(abilities: SimAbilityOrNull[], startedAt: number): (number | null)[] {
  const readyAt: (number | null)[] = [];
  for (const ability of abilities) {
    readyAt.push(ability === null ? null : startedAt);
  }
  return readyAt;
}

function readConsumableReadyAt(count: number, startedAt: number): number[] {
  const readyAt: number[] = [];
  for (let index = 0; index < count; index += 1) {
    readyAt.push(startedAt);
  }
  return readyAt;
}

function cloneConsumables(consumables: SimConsumable[]): SimConsumable[] {
  const cloned: SimConsumable[] = [];
  for (const consumable of consumables) {
    cloned.push({ ...consumable });
  }
  return cloned;
}

function createTrainer(tile: Tile, creatureTile: Tile): SimTrainer {
  return {
    dir: directionBetween(tile, creatureTile),
    tile: cloneTile(tile),
    trail: [cloneTile(tile)],
  };
}

/**
 * The tile where the trainer starts: three loop nodes behind the spawn.
 *
 * The trainer never shares the spawn tile with the creature. A tiny loop, or a
 * spawn that is not on the loop, falls back to the first other loop node so the
 * gap is kept instead of stacking the two actors.
 */
function readTrainerTile(map: HuntMap, spawnIndex: number, spawn: Tile): Tile {
  const loop = map.loop;
  if (loop.length === 0) {
    return cloneTile(spawn);
  }
  const behind = loop[readLoopNode(loop.length, spawnIndex - 3)];
  if (behind !== undefined && !sameTile(behind, spawn)) {
    return cloneTile(behind);
  }
  for (let offset = 1; offset <= loop.length; offset += 1) {
    const node = loop[readLoopNode(loop.length, spawnIndex - offset)];
    if (node !== undefined && !sameTile(node, spawn)) {
      return cloneTile(node);
    }
  }
  return cloneTile(spawn);
}

function readLoopNode(length: number, index: number): number {
  return ((index % length) + length) % length;
}

function readFirstAliveId(members: SimTeamMember[]): string {
  for (const member of members) {
    if (isAlive(member)) {
      return member.id;
    }
  }
  return members[0]?.id ?? '';
}

function createEmptyLedger(): HuntLedger {
  return { drops: [], encounters: 0, experience: 0, kills: 0, spent: [] };
}
