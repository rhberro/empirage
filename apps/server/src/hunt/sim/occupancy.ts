import type { Tile } from '@creatures/contracts/world';

import { neighbors8 } from '~/hunt/sim/geometry';
import type { SimState } from '~/hunt/sim/types';
import { activeCreature, isAlive, sameTile } from '~/hunt/sim/types';

/** The actor id used by the trainer, which has no creature of its own. */
export const TRAINER_ACTOR_ID = 'trainer';

/** Anything with a confirmed tile and, maybe, a step in course. */
type Occupant = {
  segment?: { to: Tile };
  tile: Tile;
};

/**
 * Whether a tile is taken by an actor other than the mover.
 *
 * The confirmed tile and the destination of the step in course both block, so
 * two actors can never end a step on the same square and never cross each
 * other. Only the active creature of the team is in the field: the creatures
 * waiting on the bench do not block anything.
 */
export function isTileBlocked(state: SimState, tile: Tile, moverId: string | null): boolean {
  const active = activeCreature(state);
  if (active.id !== moverId && occupies(active, tile)) {
    return true;
  }
  // The trainer is a decorative follower: it never blocks the active creature
  // (or a wild) on its way. When it did, a creature returning to its loop could
  // be trapped by its own trainer.
  for (const wild of state.wilds) {
    if (wild.id === moverId || !isAlive(wild)) {
      continue;
    }
    if (occupies(wild, tile)) {
      return true;
    }
  }
  return false;
}

/** How many rings around a taken tile a swap or a chase looks for a free one. */
const FREE_TILE_RADIUS = 4;

/**
 * The closest free tile around an origin, when the origin itself is taken.
 *
 * The mover is ignored, so a swap can reuse the tile of the creature that is
 * leaving the field. The search starts with the eight neighbors and expands in
 * rings: a target fully surrounded by actors still has a free square to aim
 * at, and nobody needs to step on an occupied tile. When nothing is free the
 * origin is returned anyway: the caller is swapping actors, not creating one
 * out of nothing, so falling back to the tile being vacated is the safest
 * answer.
 */
export function findFreeTileNear(
  state: SimState,
  origin: Tile,
  moverId: string,
  isWalkable?: (tile: Tile) => boolean,
  preferFrom?: Tile,
): Tile {
  if (isFreeTile(state, origin, moverId, isWalkable)) {
    return cloneTile(origin);
  }
  const neighbors = readFreeTiles(state, neighbors8(origin), moverId, isWalkable);
  if (neighbors.length > 0) {
    return cloneTile(pickNearest(neighbors, preferFrom));
  }
  for (let radius = 2; radius <= FREE_TILE_RADIUS; radius += 1) {
    const ring = readFreeTiles(state, readRing(origin, radius), moverId, isWalkable);
    if (ring.length > 0) {
      return cloneTile(pickNearest(ring, preferFrom));
    }
  }
  return cloneTile(origin);
}

function readFreeTiles(
  state: SimState,
  tiles: Tile[],
  moverId: string,
  isWalkable?: (tile: Tile) => boolean,
): Tile[] {
  const free: Tile[] = [];
  for (const tile of tiles) {
    if (isFreeTile(state, tile, moverId, isWalkable)) {
      free.push(tile);
    }
  }
  return free;
}

/**
 * The candidate closest to the mover, by squared Euclidean distance.
 *
 * The Chebyshev distance would tie the straight and the diagonal neighbor, and
 * the fixed order of the ring would pick the diagonal that is farther from the
 * creature. The squared distance picks the direct step: a creature coming from
 * below-left surrounds the target on the down-left, not around the other side.
 * Equal distances keep the order of the candidates, so the choice is
 * deterministic.
 */
function pickNearest(candidates: Tile[], preferFrom?: Tile): Tile {
  const first = candidates[0] as Tile;
  if (preferFrom === undefined) {
    return first;
  }
  let best = first;
  let bestDistance = squaredDistance(preferFrom, first);
  for (const candidate of candidates) {
    const distance = squaredDistance(preferFrom, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function squaredDistance(left: Tile, right: Tile): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function isFreeTile(
  state: SimState,
  tile: Tile,
  moverId: string,
  isWalkable?: (tile: Tile) => boolean,
): boolean {
  if (isWalkable !== undefined && !isWalkable(tile)) {
    return false;
  }
  // A slot never stacks on the trainer: movement may pass through the
  // decorative follower, but a creature should not stop on top of it.
  if (occupies(state.trainer, tile)) {
    return false;
  }
  return !isTileBlocked(state, tile, moverId);
}

/**
 * The tiles exactly `radius` squares away, scanned top to bottom and left to
 * right so the choice is deterministic.
 */
function readRing(origin: Tile, radius: number): Tile[] {
  const tiles: Tile[] = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
        continue;
      }
      tiles.push({ x: origin.x + dx, y: origin.y + dy });
    }
  }
  return tiles;
}

function occupies(actor: Occupant, tile: Tile): boolean {
  if (sameTile(actor.tile, tile)) {
    return true;
  }
  return actor.segment !== undefined && sameTile(actor.segment.to, tile);
}

function cloneTile(tile: Tile): Tile {
  return { x: tile.x, y: tile.y };
}
