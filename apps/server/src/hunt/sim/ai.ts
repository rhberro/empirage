import type { Tile } from '@creatures/contracts/world';
import { isWalkableTile } from '@creatures/contracts/world';

import { castAbility, effectiveRange } from '~/hunt/sim/combat';
import { chebyshev, directionBetween } from '~/hunt/sim/geometry';
import { startStep, stepToward } from '~/hunt/sim/movement';
import { findFreeTileNear, isTileBlocked } from '~/hunt/sim/occupancy';
import type {
  SimAbility,
  SimContent,
  SimCreature,
  SimEvent,
  SimState,
  SimTeamMember,
} from '~/hunt/sim/types';
import { activeCreature, isAlive, sameTile } from '~/hunt/sim/types';
import { TARGET_ACQUIRE_RANGE, TARGET_LOST_RANGE } from '~/hunt/sim/world';

export { TARGET_ACQUIRE_RANGE, TARGET_LOST_RANGE };
export { thinkTrainer, thinkWild } from '~/hunt/sim/wildAi';

type AbilityCandidate = {
  ability: SimAbility;
  readyAt: number;
  slot: number;
};

/**
 * The nearest wild inside the reach, with the lowest id breaking the tie.
 *
 * The tie break is not cosmetic: it makes the acquisition of a target
 * independent of the order the wilds happen to be in the array.
 */
export function findNearestWild(state: SimState, from: Tile, range: number): SimCreature | null {
  let best: SimCreature | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const wild of state.wilds) {
    if (!isAlive(wild)) {
      continue;
    }
    const distance = chebyshev(from, wild.tile);
    if (distance > range) {
      continue;
    }
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && wild.id < best.id)
    ) {
      best = wild;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The creature of the player a wild may target, when there is one.
 */
export function findPlayerTarget(state: SimState): SimTeamMember | null {
  const active = activeCreature(state);
  return isAlive(active) ? active : null;
}

/**
 * One decision of the active creature.
 *
 * Target beats loop: while a wild is inside the reach the creature chases it
 * and uses the rotation; when there is no target it walks the loop of the
 * area. The rotation only runs when the creature is already inside the reach
 * of an ability, and it respects both the global interval and the cooldown of
 * each slot.
 */
export function thinkPlayer(
  state: SimState,
  content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  const active = activeCreature(state);
  if (!isAlive(active)) {
    return;
  }
  let target = readWild(state, active.targetId);
  if (
    target !== null &&
    (!isAlive(target) || chebyshev(active.tile, target.tile) > TARGET_LOST_RANGE)
  ) {
    clearPlayerTarget(active, now, events);
    target = null;
  }
  if (target === null) {
    target = findNearestWild(state, active.tile, TARGET_ACQUIRE_RANGE);
    if (target !== null) {
      acquirePlayerTarget(state, active, target, now, events);
    }
  }
  if (target === null) {
    followLoop(state, active, content, now);
    return;
  }
  const isBlocked = readBlockedTile(state, active.id);
  const distance = chebyshev(active.tile, target.tile);
  if (distance > desiredRange(active)) {
    stepToward(
      active,
      chaseDestination(state, active, target, content),
      now,
      content.map,
      isBlocked,
    );
  } else {
    tryRotation(state, content, active, target, now, events);
  }
  // The facing follows the target after the step is decided: the next delta
  // then carries the look, not only the direction of the walk.
  active.dir = directionBetween(active.tile, target.tile);
}

function followLoop(
  state: SimState,
  active: SimTeamMember,
  content: SimContent,
  now: number,
): void {
  const loop = content.map.loop;
  if (loop.length === 0) {
    return;
  }
  let index = state.loopIndex % loop.length;
  let node = loop[index];
  if (node !== undefined && sameTile(active.tile, node)) {
    index = (index + 1) % loop.length;
    node = loop[index];
  }
  state.loopIndex = index;
  active.loopIndex = index;
  if (node === undefined || sameTile(active.tile, node)) {
    return;
  }
  const isBlocked = readBlockedTile(state, active.id);
  if (chebyshev(active.tile, node) <= 1) {
    startStep(active, node, now, content.map, isBlocked);
    return;
  }
  stepToward(active, node, now, content.map, isBlocked);
}

function tryRotation(
  state: SimState,
  content: SimContent,
  active: SimTeamMember,
  target: SimCreature,
  now: number,
  events: SimEvent[],
): void {
  if (now < active.nextAbilityAt) {
    return;
  }
  const distance = chebyshev(active.tile, target.tile);
  const candidates: AbilityCandidate[] = [];
  for (let slot = 0; slot < active.abilities.length; slot += 1) {
    const ability = active.abilities[slot];
    if (ability === undefined || ability === null) {
      continue;
    }
    const readyAt = active.abilityReadyAt[slot] ?? 0;
    if (readyAt > now || distance > effectiveRange(ability)) {
      continue;
    }
    candidates.push({ ability, readyAt, slot });
  }
  if (candidates.length === 0) {
    return;
  }
  candidates.sort(compareCandidates);
  const chosen = candidates[0];
  if (chosen === undefined) {
    return;
  }
  castAbility(state, content, active, chosen.ability, target, now, events);
}

/**
 * The closest distance at which the creature still has something to cast.
 *
 * It is the smallest effective range of the equipped abilities, never zero; a
 * creature with no abilities closes to melee. A self area contributes its
 * radius, not its (usually zero) launch range.
 */
function desiredRange(active: SimTeamMember): number {
  let range = Number.POSITIVE_INFINITY;
  for (const ability of active.abilities) {
    if (ability !== null && ability !== undefined) {
      range = Math.min(range, effectiveRange(ability));
    }
  }
  if (!Number.isFinite(range)) {
    return 1;
  }
  return Math.max(1, range);
}

/**
 * The free square next to the target the chase walks to.
 *
 * Aiming at the occupied tile itself would make the search fail forever; the
 * nearest free tile lets the pathfinder route around the actors on the way.
 */
function chaseDestination(
  state: SimState,
  active: SimTeamMember,
  target: SimCreature,
  content: SimContent,
): Tile {
  return findFreeTileNear(
    state,
    target.tile,
    active.id,
    function isWalkable(tile: Tile): boolean {
      return isWalkableTile(content.map, tile);
    },
    active.tile,
  );
}

function readWild(state: SimState, id: string | null): SimCreature | null {
  if (id === null) {
    return null;
  }
  for (const wild of state.wilds) {
    if (wild.id === id) {
      return wild;
    }
  }
  return null;
}

function acquirePlayerTarget(
  state: SimState,
  active: SimTeamMember,
  target: SimCreature,
  now: number,
  events: SimEvent[],
): void {
  active.targetId = target.id;
  active.behavior = 'chase';
  if (target.encountered !== true) {
    target.encountered = true;
    state.ledger.encounters += 1;
  }
  events.push({ actorId: active.id, at: now, targetId: target.id, type: 'target_changed' });
}

function clearPlayerTarget(active: SimTeamMember, now: number, events: SimEvent[]): void {
  active.targetId = null;
  active.behavior = 'loop';
  events.push({ actorId: active.id, at: now, targetId: null, type: 'target_changed' });
}

/**
 * The occupancy test of one mover, bound to the state for the walk helpers.
 */
export function readBlockedTile(state: SimState, moverId: string): (tile: Tile) => boolean {
  return function isBlocked(tile: Tile): boolean {
    return isTileBlocked(state, tile, moverId);
  };
}

function compareCandidates(left: AbilityCandidate, right: AbilityCandidate): number {
  if (left.readyAt !== right.readyAt) {
    return left.readyAt - right.readyAt;
  }
  return left.slot - right.slot;
}
