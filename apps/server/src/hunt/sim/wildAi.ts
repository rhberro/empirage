/* eslint-disable max-lines -- the wild AI keeps the target, the flow step and the abilities together */
import { isWalkableTile } from '@creatures/contracts/world';
import type { Tile } from '@creatures/contracts/world';

import { drawInt } from '~/hunt/rng';
import { castAbility, effectiveRange, MELEE_ABILITY } from '~/hunt/sim/combat';
import { readFlowField, readFlowStep } from '~/hunt/sim/flow';
import type { FlowField } from '~/hunt/sim/flow';
import { chebyshev, directionBetween, neighbors8 } from '~/hunt/sim/geometry';
import { advanceTrainer, startStep, stepToward } from '~/hunt/sim/movement';
import { findFreeTileNear, isTileBlocked, TRAINER_ACTOR_ID } from '~/hunt/sim/occupancy';
import type {
  SimContent,
  SimCreature,
  SimEvent,
  SimSpecies,
  SimState,
  SimTeamMember,
} from '~/hunt/sim/types';
import { activeCreature, isAlive } from '~/hunt/sim/types';
import {
  readOrderedWilds,
  TARGET_ACQUIRE_RANGE,
  TARGET_LOST_RANGE,
  WILD_DECISION_MS,
} from '~/hunt/sim/world';

/** How far a wild may wander from its spawn before going back. */
export const WILD_LEASH_RANGE = 3;

/** The interval between two melee hits of a wild. */
export const WILD_MELEE_INTERVAL_MS = 2000;

/** How often a wild decides to take a random step while idle. */
const WILD_WALK_CHANCE = 60;

/**
 * The decision of every wild, in the stable spawn order.
 *
 * The decision runs at most once per second. It first reads the target, then
 * the melee, then every ability of the species: each ability rolls its own
 * chance, in the order the species declares them, and the random stream only
 * advances for an ability that is off cooldown and inside its reach.
 */
export function thinkWild(
  state: SimState,
  content: SimContent,
  now: number,
  events: SimEvent[],
  flow?: FlowField,
): void {
  for (const wild of readOrderedWilds(state)) {
    thinkOneWild(state, content, wild, now, events, flow);
  }
}

/**
 * The trainer follows the trail of the active creature.
 */
export function thinkTrainer(state: SimState, now: number, content: SimContent): void {
  const active = activeCreature(state);
  advanceTrainer(state.trainer, active.tile, now, content.map, function isBlocked(tile: Tile) {
    return isTileBlocked(state, tile, TRAINER_ACTOR_ID);
  });
}

function thinkOneWild(
  state: SimState,
  content: SimContent,
  wild: SimCreature,
  now: number,
  events: SimEvent[],
  flow?: FlowField,
): void {
  if (!isAlive(wild)) {
    return;
  }
  if (now < wild.nextDecisionAt) {
    faceTarget(state, wild);
    return;
  }
  wild.nextDecisionAt = now + WILD_DECISION_MS;
  const species = content.species[wild.speciesSlug];
  if (species === undefined) {
    return;
  }
  const target = readWildTarget(state, wild, now, events);
  if (target !== null) {
    pursueTarget(state, content, wild, species, target, now, events, flow);
    return;
  }
  wander(state, content, wild, now);
}

function readWildTarget(
  state: SimState,
  wild: SimCreature,
  now: number,
  events: SimEvent[],
): SimTeamMember | null {
  const active = activeCreature(state);
  if (!isAlive(active)) {
    if (wild.targetId !== null) {
      clearWildTarget(wild, now, events);
    }
    return null;
  }
  if (wild.targetId !== active.id) {
    if (chebyshev(wild.tile, active.tile) <= TARGET_ACQUIRE_RANGE) {
      wild.targetId = active.id;
      wild.behavior = 'chase';
      events.push({ actorId: wild.id, at: now, targetId: active.id, type: 'target_changed' });
      return active;
    }
    if (wild.targetId !== null) {
      clearWildTarget(wild, now, events);
    }
    return null;
  }
  if (chebyshev(wild.tile, active.tile) > TARGET_LOST_RANGE) {
    clearWildTarget(wild, now, events);
    return null;
  }
  return active;
}

function pursueTarget(
  state: SimState,
  content: SimContent,
  wild: SimCreature,
  species: SimSpecies,
  target: SimCreature,
  now: number,
  events: SimEvent[],
  flow?: FlowField,
): void {
  wild.behavior = 'chase';
  const isBlocked = readWildBlockedTile(state, wild.id);
  const distance = chebyshev(wild.tile, target.tile);
  moveTowardTarget(
    state,
    content,
    wild,
    target,
    distance,
    desiredRange(species),
    flow,
    now,
    isBlocked,
  );
  if (distance <= MELEE_ABILITY.range && now >= wild.meleeReadyAt) {
    castAbility(state, content, wild, MELEE_ABILITY, target, now, events);
    wild.meleeReadyAt = now + WILD_MELEE_INTERVAL_MS;
  }
  for (const entry of species.abilities) {
    if (now < (wild.wildReadyAt[entry.ability.slug] ?? 0)) {
      continue;
    }
    if (distance > effectiveRange(entry.ability)) {
      continue;
    }
    const roll = drawInt(state.rng, 100);
    state.rng = roll.state;
    if (roll.value < entry.wildChance) {
      castAbility(state, content, wild, entry.ability, target, now, events);
    }
  }
  // A wild with a target looks at it, even when the step of this decision
  // pointed somewhere else on the way.
  wild.dir = directionBetween(wild.tile, target.tile);
}

/**
 * The step of a wild toward its target.
 *
 * Far away, the whole pack reads the same distance field to the target: one
 * breadth-first pass instead of one path search per wild. Close to the target,
 * the exact free tile decides the side of the surround.
 */
function moveTowardTarget(
  state: SimState,
  content: SimContent,
  wild: SimCreature,
  target: SimCreature,
  distance: number,
  range: number,
  flow: FlowField | undefined,
  now: number,
  isBlocked: (tile: Tile) => boolean,
): void {
  if (distance <= range) {
    return;
  }
  if (flow !== undefined && distance > range + 1) {
    readFlowField(flow, content.map, target.tile);
    const next = readFlowStep(flow, content.map, wild.tile, isBlocked);
    if (next !== null) {
      startStep(wild, next, now, content.map, isBlocked);
    }
    return;
  }
  const destination = findFreeTileNear(
    state,
    target.tile,
    wild.id,
    function isWalkable(tile: Tile): boolean {
      return isWalkableTile(content.map, tile);
    },
    wild.tile,
  );
  stepToward(wild, destination, now, content.map, isBlocked);
}

function wander(state: SimState, content: SimContent, wild: SimCreature, now: number): void {
  const spawnTile = wild.spawnTile;
  if (spawnTile !== undefined && chebyshev(wild.tile, spawnTile) > WILD_LEASH_RANGE) {
    wild.behavior = 'return';
    stepToward(wild, spawnTile, now, content.map, readWildBlockedTile(state, wild.id));
    return;
  }
  wild.behavior = 'idle';
  if (wild.segment !== undefined) {
    return;
  }
  const walkRoll = drawInt(state.rng, 100);
  state.rng = walkRoll.state;
  if (walkRoll.value < WILD_WALK_CHANCE) {
    takeRandomStep(state, content, wild, now);
    return;
  }
  const wait = drawInt(state.rng, 1201);
  state.rng = wait.state;
  wild.nextDecisionAt = now + 600 + wait.value;
}

function takeRandomStep(
  state: SimState,
  content: SimContent,
  wild: SimCreature,
  now: number,
): void {
  const walkable: Tile[] = [];
  for (const tile of neighbors8(wild.tile)) {
    if (isWalkableTile(content.map, tile) && !isTileBlocked(state, tile, wild.id)) {
      walkable.push(tile);
    }
  }
  if (walkable.length > 0) {
    const choice = drawInt(state.rng, walkable.length);
    state.rng = choice.state;
    const tile = walkable[choice.value];
    if (tile !== undefined) {
      startStep(wild, tile, now, content.map, readWildBlockedTile(state, wild.id));
    }
  }
  const delay = drawInt(state.rng, 301);
  state.rng = delay.state;
  wild.nextDecisionAt = now + Math.max(600 + delay.value, WILD_DECISION_MS);
}

function desiredRange(species: SimSpecies): number {
  if (species.abilities.length === 0) {
    return 1;
  }
  let range = Number.POSITIVE_INFINITY;
  for (const entry of species.abilities) {
    range = Math.min(range, effectiveRange(entry.ability));
  }
  // A self area contributes its radius; no ability may collapse the desired
  // distance to zero, because melee is always one square.
  return Math.max(1, range);
}

function clearWildTarget(wild: SimCreature, now: number, events: SimEvent[]): void {
  wild.targetId = null;
  wild.behavior = 'return';
  events.push({ actorId: wild.id, at: now, targetId: null, type: 'target_changed' });
}

/**
 * Turns a wild towards the active creature it is chasing, when it has one.
 *
 * The decision itself writes the facing after moving; this helper keeps the
 * look on the target between decisions too, so a finished step does not leave
 * the wild facing the walk direction.
 */
function faceTarget(state: SimState, wild: SimCreature): void {
  if (wild.targetId === null) {
    return;
  }
  const active = activeCreature(state);
  if (active.id === wild.targetId && isAlive(active)) {
    wild.dir = directionBetween(wild.tile, active.tile);
  }
}

/**
 * The occupancy test of one wild, bound to the state for the walk helpers.
 */
function readWildBlockedTile(state: SimState, wildId: string): (tile: Tile) => boolean {
  return function isBlocked(tile: Tile): boolean {
    return isTileBlocked(state, tile, wildId);
  };
}
