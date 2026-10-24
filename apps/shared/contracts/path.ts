import { MAP_DIAGONALWALKCOST, MAP_NORMALWALKCOST, astarToTargets } from './astar';
import type { CityMap, Direction, Tile } from './world';
import { isSolidTile, isWalkableTile, tileAt } from './world';

/**
 * The longest walk a single command may produce.
 *
 * The limit is a guard on the answer, not on the search: a click far away is
 * refused with `invalid_target` instead of flooding the channel with steps.
 */
export const MAX_PATH_STEPS = 512;

/**
 * The cost of crossing one square, in the style of Tibia (Canary `AStarNodes`).
 *
 * An orthogonal step costs ten and a diagonal thirty-five: walking two
 * orthogonal steps must stay cheaper than cutting the corner, so a walk
 * follows the straight lines first.
 */
export const ORTHOGONAL_STEP_COST = MAP_NORMALWALKCOST;
export const DIAGONAL_STEP_COST = MAP_DIAGONALWALKCOST;

export type PathStep = {
  dir: Direction;
  from: Tile;
  to: Tile;
};

export type PathFailure = 'invalid_target' | 'tile_blocked';

export type PathResult = { code: PathFailure; ok: false } | { ok: true; steps: PathStep[] };

type Neighbor = readonly [number, number, Direction, number];

/** dx, dy, direction, cost. The order is the tie-break of the search. */
const NEIGHBORS: ReadonlyArray<Neighbor> = [
  [0, -1, 'up', ORTHOGONAL_STEP_COST],
  [1, -1, 'upRight', DIAGONAL_STEP_COST],
  [1, 0, 'right', ORTHOGONAL_STEP_COST],
  [1, 1, 'downRight', DIAGONAL_STEP_COST],
  [0, 1, 'down', ORTHOGONAL_STEP_COST],
  [-1, 1, 'downLeft', DIAGONAL_STEP_COST],
  [-1, 0, 'left', ORTHOGONAL_STEP_COST],
  [-1, -1, 'upLeft', DIAGONAL_STEP_COST],
];

/**
 * The walk to a square, with the steps in the order they are taken.
 *
 * A solid target resolves to the closest free square next to it, so a click
 * on a tree still moves the trainer to its side. The optional `isBlocked`
 * removes dynamically occupied squares from the search (and from the target),
 * so a chase can route around another actor; the city never passes it.
 */
export function findPath(
  map: CityMap,
  from: Tile,
  to: Tile,
  isBlocked?: (tile: Tile) => boolean,
): PathResult {
  if (!isWalkableTile(map, from) || !isInside(map, to)) {
    return { code: 'invalid_target', ok: false };
  }
  if (sameTile(from, to)) {
    return { ok: true, steps: [] };
  }
  const targets = readTargets(map, to, isBlocked);
  if (targets.length === 0) {
    return { code: 'tile_blocked', ok: false };
  }
  for (const target of targets) {
    if (sameTile(target, from)) {
      return { ok: true, steps: [] };
    }
  }
  const weighted = searchWeighted(map, from, targets, isBlocked);
  if (weighted === null) {
    return { code: 'tile_blocked', ok: false };
  }
  if (weighted.length <= MAX_PATH_STEPS) {
    return { ok: true, steps: weighted };
  }
  // The cheapest walk may be a staircase longer than the answer limit. A
  // diagonal-heavy walk with fewer steps is still a legal answer, so the
  // limit refuses the flood, not the destination.
  const minimal = searchMinimalSteps(map, from, targets, isBlocked);
  if (minimal === null) {
    return { code: 'tile_blocked', ok: false };
  }
  if (minimal.length > MAX_PATH_STEPS) {
    return { code: 'invalid_target', ok: false };
  }
  return { ok: true, steps: minimal };
}

function isInside(map: CityMap, tile: Tile): boolean {
  return tile.x >= 0 && tile.y >= 0 && tile.x < map.width && tile.y < map.height;
}

function sameTile(left: Tile, right: Tile): boolean {
  return left.x === right.x && left.y === right.y;
}

/** A solid or dynamically blocked click resolves to its free neighbors. */
function readTargets(map: CityMap, to: Tile, isBlocked?: (tile: Tile) => boolean): Tile[] {
  if (isWalkableTile(map, to) && !isDynamicallyBlocked(to, isBlocked)) {
    return [to];
  }
  const targets: Tile[] = [];
  for (const neighbor of NEIGHBORS) {
    const [dx, dy] = neighbor;
    const candidate = { x: to.x + dx, y: to.y + dy };
    if (isWalkableTile(map, candidate) && !isDynamicallyBlocked(candidate, isBlocked)) {
      targets.push(candidate);
    }
  }
  return targets;
}

function isDynamicallyBlocked(tile: Tile, isBlocked?: (tile: Tile) => boolean): boolean {
  return isBlocked !== undefined && isBlocked(tile);
}

/**
 * A* with the weighted cost; the first target finalized is the cheapest.
 *
 * The heuristic keeps the same deterministic tie-break as the neighbor order:
 * the same click always produces the same walk.
 */
function searchWeighted(
  map: CityMap,
  from: Tile,
  targets: Tile[],
  isBlocked?: (tile: Tile) => boolean,
): PathStep[] | null {
  return astarToTargets(map, from, targets, isBlocked);
}

/**
 * Breadth-first search with uniform steps, used only when the weighted walk
 * does not fit the answer limit: diagonals keep a far click reachable.
 */
function searchMinimalSteps(
  map: CityMap,
  from: Tile,
  targets: Tile[],
  isBlocked?: (tile: Tile) => boolean,
): PathStep[] | null {
  const targetKeys = readTargetKeys(map, targets);
  const start = from.y * map.width + from.x;
  const parent = new Map<number, number>();
  const directions = new Map<number, Direction>();
  const queue: number[] = [start];
  parent.set(start, -1);

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const x = current % map.width;
    const y = Math.floor(current / map.width);
    for (const neighbor of NEIGHBORS) {
      const [dx, dy, dir, cost] = neighbor;
      const nextX = x + dx;
      const nextY = y + dy;
      if (!isWalkableTile(map, { x: nextX, y: nextY })) {
        continue;
      }
      if (isDynamicallyBlocked({ x: nextX, y: nextY }, isBlocked)) {
        continue;
      }
      if (cost === DIAGONAL_STEP_COST && blocksCorner(map, x, y, dx, dy)) {
        continue;
      }
      const key = nextY * map.width + nextX;
      if (parent.has(key)) {
        continue;
      }
      parent.set(key, current);
      directions.set(key, dir);
      if (targetKeys.has(key)) {
        return reconstruct(parent, directions, map.width, key);
      }
      queue.push(key);
    }
  }
  return null;
}

function readTargetKeys(map: CityMap, targets: Tile[]): Set<number> {
  const keys = new Set<number>();
  for (const target of targets) {
    keys.add(target.y * map.width + target.x);
  }
  return keys;
}

function blocksCorner(map: CityMap, x: number, y: number, dx: number, dy: number): boolean {
  return isSolidTile(tileAt(map, x + dx, y)) && isSolidTile(tileAt(map, x, y + dy));
}

function reconstruct(
  parent: Map<number, number>,
  directions: Map<number, Direction>,
  width: number,
  target: number,
): PathStep[] {
  const steps: PathStep[] = [];
  let key = target;
  let previous = parent.get(key);
  while (previous !== undefined && previous !== -1) {
    const dir = directions.get(key);
    if (dir === undefined) {
      break;
    }
    steps.push({ dir, from: readTile(previous, width), to: readTile(key, width) });
    key = previous;
    previous = parent.get(key);
  }
  steps.reverse();
  return steps;
}

function readTile(key: number, width: number): Tile {
  return { x: key % width, y: Math.floor(key / width) };
}
