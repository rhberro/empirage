import { popEntry, pushEntry } from './priorityQueue';
import type { SearchEntry } from './priorityQueue';
import type { CityMap, Direction, Tile } from './world';
import { isSolidTile, isWalkableTile, tileAt } from './world';

/**
 * The cost of walking one square, as in the Canary `AStarNodes`.
 *
 * `MAP_NORMALWALKCOST` is the orthogonal step and `MAP_DIAGONALWALKCOST` the
 * diagonal one. Canary prices the diagonal at 3.5x (35 vs 10), which keeps the
 * straight lines preferred over cutting corners.
 */
export const MAP_NORMALWALKCOST = 10;
export const MAP_DIAGONALWALKCOST = 35;

/** How many nodes the search may expand before it gives up. Canary: 512. */
export const MAX_NODES = 512;

export type PathStep = {
  dir: Direction;
  from: Tile;
  to: Tile;
};

/**
 * The search parameters of Canary (`FindPathParams`).
 *
 * `allowDiagonal` is kept for API parity: in Canary it is never read by the A*
 * itself, only when matching queued requests. `clearSight` needs a line of
 * sight and is ignored here; the walkability check already refuses walls.
 */
export type FindPathParams = {
  allowDiagonal: boolean;
  clearSight: boolean;
  fullPathSearch: boolean;
  keepDistance: boolean;
  maxSearchDist: number;
  maxTargetDist: number;
  minTargetDist: number;
};

type Neighbor = readonly [number, number, Direction, number];

/** dx, dy, direction, cost. The order is the tie-break of the search. */
const NEIGHBORS: ReadonlyArray<Neighbor> = [
  [0, -1, 'up', MAP_NORMALWALKCOST],
  [1, -1, 'upRight', MAP_DIAGONALWALKCOST],
  [1, 0, 'right', MAP_NORMALWALKCOST],
  [1, 1, 'downRight', MAP_DIAGONALWALKCOST],
  [0, 1, 'down', MAP_NORMALWALKCOST],
  [-1, 1, 'downLeft', MAP_DIAGONALWALKCOST],
  [-1, 0, 'left', MAP_NORMALWALKCOST],
  [-1, -1, 'upLeft', MAP_DIAGONALWALKCOST],
];

function chebyshev(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The admissible octile heuristic for the 10/35 costs: diagonals cost 35 each
 * and the remainder is crossed orthogonally at 10 each.
 */
export function octileDistance(a: Tile, b: Tile): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return MAP_NORMALWALKCOST * Math.abs(dx - dy) + MAP_DIAGONALWALKCOST * Math.min(dx, dy);
}

function keyOf(tile: Tile, width: number): number {
  return tile.y * width + tile.x;
}

function readTile(key: number, width: number): Tile {
  return { x: key % width, y: Math.floor(key / width) };
}

function blocksCorner(map: CityMap, x: number, y: number, dx: number, dy: number): boolean {
  return isSolidTile(tileAt(map, x + dx, y)) && isSolidTile(tileAt(map, x, y + dy));
}

export type AstarSearchOptions = {
  canExpand?: (tile: Tile) => boolean;
  isBlocked?: (tile: Tile) => boolean;
  maxNodes?: number;
};

/**
 * A* from `from` to the first tile that satisfies `isGoal`.
 *
 * The heap orders by `f = g + h`; `best` keeps the g of each key so a stale
 * entry is dropped. With an admissible, consistent heuristic the first goal
 * that is finalized is optimal. Without `maxNodes` the search covers the map.
 */
export function aStarSearch(
  map: CityMap,
  from: Tile,
  isGoal: (tile: Tile) => boolean,
  heuristic: (tile: Tile) => number,
  options: AstarSearchOptions = {},
): PathStep[] | null {
  const { canExpand, isBlocked, maxNodes = Number.POSITIVE_INFINITY } = options;
  const width = map.width;
  const start = keyOf(from, width);
  const best = new Map<number, number>();
  const parent = new Map<number, number>();
  const directions = new Map<number, Direction>();
  const heap: SearchEntry[] = [];
  let order = 0;

  best.set(start, 0);
  parent.set(start, -1);
  pushEntry(heap, { cost: heuristic(from), key: start, order });
  order += 1;

  let finalized = 0;
  while (heap.length > 0) {
    const current = popEntry(heap);
    if (current === undefined) {
      break;
    }
    const tile = readTile(current.key, width);
    const g = best.get(current.key);
    if (g === undefined || current.cost > g + heuristic(tile)) {
      continue;
    }
    finalized += 1;
    if (finalized > maxNodes) {
      return null;
    }
    if (isGoal(tile)) {
      return reconstruct(parent, directions, width, current.key);
    }
    relax(map, tile, g, best, parent, directions, heap, heuristic, isBlocked, canExpand, order);
    order += NEIGHBORS.length;
  }
  return null;
}

function relax(
  map: CityMap,
  tile: Tile,
  g: number,
  best: Map<number, number>,
  parent: Map<number, number>,
  directions: Map<number, Direction>,
  heap: SearchEntry[],
  heuristic: (tile: Tile) => number,
  isBlocked: ((tile: Tile) => boolean) | undefined,
  canExpand: ((tile: Tile) => boolean) | undefined,
  order: number,
): void {
  const width = map.width;
  for (let index = 0; index < NEIGHBORS.length; index += 1) {
    const neighbor = NEIGHBORS[index];
    if (neighbor === undefined) {
      continue;
    }
    const [dx, dy, dir, cost] = neighbor;
    const nextTile = { x: tile.x + dx, y: tile.y + dy };
    if (!isWalkableTile(map, nextTile)) {
      continue;
    }
    if (isBlocked !== undefined && isBlocked(nextTile)) {
      continue;
    }
    if (canExpand !== undefined && !canExpand(nextTile)) {
      continue;
    }
    if (cost === MAP_DIAGONALWALKCOST && blocksCorner(map, tile.x, tile.y, dx, dy)) {
      continue;
    }
    const key = nextTile.y * width + nextTile.x;
    const nextG = g + cost;
    const known = best.get(key);
    if (known !== undefined && nextG >= known) {
      continue;
    }
    best.set(key, nextG);
    parent.set(key, keyOf(tile, width));
    directions.set(key, dir);
    pushEntry(heap, { cost: nextG + heuristic(nextTile), key, order: order + index });
  }
}

/**
 * A* to the cheapest tile of a set.
 *
 * Used by `findPath` after it resolves a solid click to its free neighbors.
 * No node cap: the set is bounded by the map, and a far click is legal until
 * the answer-length limit, not the search one.
 */
export function astarToTargets(
  map: CityMap,
  from: Tile,
  targets: Tile[],
  isBlocked?: (tile: Tile) => boolean,
): PathStep[] | null {
  const width = map.width;
  const targetKeys = new Set<number>();
  for (const target of targets) {
    targetKeys.add(keyOf(target, width));
  }
  return aStarSearch(
    map,
    from,
    function isTarget(tile: Tile): boolean {
      return targetKeys.has(keyOf(tile, width));
    },
    function heuristic(tile: Tile): number {
      let bestH = Number.POSITIVE_INFINITY;
      for (const target of targets) {
        const h = octileDistance(tile, target);
        if (h < bestH) {
          bestH = h;
        }
      }
      return bestH;
    },
    { isBlocked },
  );
}

/**
 * A* with the `FindPathParams` of Canary: a goal ring around `to`, a search
 * radius from `from`, and the 512-node cap.
 */
export function findPathWithParams(
  map: CityMap,
  from: Tile,
  to: Tile,
  params: FindPathParams,
  isBlocked?: (tile: Tile) => boolean,
): PathStep[] | null {
  const distance = chebyshev(from, to);
  if (distance >= params.minTargetDist && distance <= params.maxTargetDist) {
    return [];
  }
  return aStarSearch(
    map,
    from,
    function isGoal(tile: Tile): boolean {
      const targetDistance = chebyshev(tile, to);
      return targetDistance >= params.minTargetDist && targetDistance <= params.maxTargetDist;
    },
    function heuristic(tile: Tile): number {
      return octileDistance(tile, to);
    },
    {
      canExpand: function canExpand(tile: Tile): boolean {
        if (params.maxSearchDist > 0 && chebyshev(from, tile) > params.maxSearchDist) {
          return false;
        }
        if (params.keepDistance && chebyshev(tile, to) < params.minTargetDist) {
          return false;
        }
        return true;
      },
      isBlocked,
      maxNodes: MAX_NODES,
    },
  );
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
