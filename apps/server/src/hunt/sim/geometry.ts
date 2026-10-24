import type { HuntMap } from '@creatures/contracts/huntMap';
import { isWalkableTile } from '@creatures/contracts/world';
import type { Direction, Tile } from '@creatures/contracts/world';

import type { SimAbility } from '~/hunt/sim/types';

/** How long an orthogonal step takes. */
export const ORTHOGONAL_STEP_MS = 300;

/** How long a diagonal step takes. */
export const DIAGONAL_STEP_MS = 424;

/** The eight directions, in the order the pathfinding and the walk read them. */
const NEIGHBOR_DIRECTIONS: readonly Direction[] = [
  'up',
  'upRight',
  'right',
  'downRight',
  'down',
  'downLeft',
  'left',
  'upLeft',
];

type DirectionVector = {
  dx: number;
  dy: number;
};

const DIRECTION_VECTORS: Record<Direction, DirectionVector> = {
  down: { dx: 0, dy: 1 },
  downLeft: { dx: -1, dy: 1 },
  downRight: { dx: 1, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  up: { dx: 0, dy: -1 },
  upLeft: { dx: -1, dy: -1 },
  upRight: { dx: 1, dy: -1 },
};

/**
 * The Chebyshev distance, the one the reach of a hunt is measured in.
 */
export function chebyshev(left: Tile, right: Tile): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

/**
 * The direction that goes from one tile to the other.
 *
 * Two different tiles always have a direction; the same tile falls back to
 * `down`, which is only a facing and never a step.
 */
export function directionBetween(from: Tile, to: Tile): Direction {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  for (const dir of NEIGHBOR_DIRECTIONS) {
    const vector = DIRECTION_VECTORS[dir];
    if (vector.dx === dx && vector.dy === dy) {
      return dir;
    }
  }
  return 'down';
}

/**
 * How long a step between two adjacent tiles takes.
 */
export function stepDuration(from: Tile, to: Tile): number {
  const diagonal = from.x !== to.x && from.y !== to.y;
  if (from.x === to.x && from.y === to.y) {
    return 0;
  }
  return diagonal ? DIAGONAL_STEP_MS : ORTHOGONAL_STEP_MS;
}

/**
 * A stable key of a tile, used to drop duplicates of an area.
 */
export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

/**
 * The eight neighbors of a tile, in a fixed order.
 */
export function neighbors8(tile: Tile): Tile[] {
  const neighbors: Tile[] = [];
  for (const dir of NEIGHBOR_DIRECTIONS) {
    const vector = DIRECTION_VECTORS[dir];
    neighbors.push({ x: tile.x + vector.dx, y: tile.y + vector.dy });
  }
  return neighbors;
}

/**
 * The tiles an area ability covers, without the time they are reached.
 *
 * A line starts on the square next to the caster and stops at the first solid
 * square; the solid square itself is not part of the area. A circle is centred
 * on the target, except for a self area, which is centred on the caster.
 */
export function areaTiles(
  ability: SimAbility,
  casterTile: Tile,
  targetTile: Tile,
  map: HuntMap,
): Tile[] {
  if (ability.areaShape === 'line') {
    return readLineTiles(ability, casterTile, targetTile, map);
  }
  if (ability.areaShape === 'circle') {
    return readCircleTiles(ability, readAreaCenter(ability, casterTile, targetTile), map);
  }
  return [];
}

/**
 * The tiles of an area, with the moment the front reaches each one.
 *
 * `startedAt` is the moment the wave leaves the caster: for a line it is the
 * moment the first square is reached, for a circle it is the centre.
 */
export function waveTiles(
  ability: SimAbility,
  casterTile: Tile,
  targetTile: Tile,
  map: HuntMap,
  startedAt: number,
): { arrivalAt: number; tile: Tile }[] {
  const tiles = areaTiles(ability, casterTile, targetTile, map);
  const center = readAreaCenter(ability, casterTile, targetTile);
  const entries: { arrivalAt: number; tile: Tile }[] = [];
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index] as Tile;
    const arrivalAt =
      ability.areaShape === 'circle'
        ? startedAt + Math.ceil(Math.sqrt(squaredDistance(center, tile))) * ability.areaStepMs
        : startedAt + (index + 1) * ability.areaStepMs;
    entries.push({ arrivalAt, tile });
  }
  return entries;
}

/**
 * The square the area is measured from.
 *
 * A self area has no launch target: its circle always grows from the caster.
 */
function readAreaCenter(ability: SimAbility, casterTile: Tile, targetTile: Tile): Tile {
  return ability.targetType === 'area_self' ? casterTile : targetTile;
}

function readLineTiles(
  ability: SimAbility,
  casterTile: Tile,
  targetTile: Tile,
  map: HuntMap,
): Tile[] {
  if (casterTile.x === targetTile.x && casterTile.y === targetTile.y) {
    return [];
  }
  const direction = directionBetween(casterTile, targetTile);
  const vector = DIRECTION_VECTORS[direction];
  const length = Math.max(0, ability.areaLength ?? 0);
  const tiles: Tile[] = [];
  for (let step = 1; step <= length; step += 1) {
    const tile = { x: casterTile.x + vector.dx * step, y: casterTile.y + vector.dy * step };
    if (!isWalkableTile(map, tile)) {
      break;
    }
    tiles.push(tile);
  }
  return tiles;
}

function readCircleTiles(ability: SimAbility, targetTile: Tile, map: HuntMap): Tile[] {
  const radius =
    ability.targetType === 'area_self'
      ? Math.max(1, ability.areaRadius ?? 1)
      : Math.max(0, ability.areaRadius ?? 0);
  const tiles: Tile[] = [];
  const seen = new Set<string>();
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) {
        continue;
      }
      const tile = { x: targetTile.x + dx, y: targetTile.y + dy };
      const key = tileKey(tile);
      if (seen.has(key) || !isWalkableTile(map, tile)) {
        continue;
      }
      seen.add(key);
      tiles.push(tile);
    }
  }
  return tiles;
}

function squaredDistance(left: Tile, right: Tile): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}
