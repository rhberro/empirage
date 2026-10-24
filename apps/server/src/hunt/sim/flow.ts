import type { CityMap, Tile } from '@creatures/contracts/world';
import { isSolidTile, isWalkableTile, tileAt } from '@creatures/contracts/world';

/**
 * The eight directions of the field, in the tie-break order of the walk.
 */
const FLOW_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/**
 * A distance field from one tile, reused by every creature that chases it.
 *
 * The wilds of a hunt all chase the same active creature. Running one Dijkstra
 * per wild costs tens of milliseconds on a 96x64 map; one breadth-first pass
 * from the target costs a fraction of that and every wild reads its next step
 * from the same array. The field ignores the actors: the caller filters the
 * immediate step against the occupancy, so the direction is stable and the
 * collision stays local.
 */
export type FlowField = {
  distances: Int32Array;
  origin: Tile | null;
  width: number;
};

export function createFlowField(): FlowField {
  return { distances: new Int32Array(0), origin: null, width: 0 };
}

/**
 * The distance field for the tile, rebuilding it only when the origin or the
 * map changed.
 */
export function readFlowField(field: FlowField, map: CityMap, origin: Tile): Int32Array {
  if (
    field.origin !== null &&
    field.origin.x === origin.x &&
    field.origin.y === origin.y &&
    field.width === map.width
  ) {
    return field.distances;
  }
  field.distances = buildFlowField(map, origin);
  field.origin = { x: origin.x, y: origin.y };
  field.width = map.width;
  return field.distances;
}

/**
 * The next step from a tile toward the field origin.
 *
 * The step must be walkable, must not cut a closed corner, must not be blocked
 * by an actor and must reduce the distance. When the closest step is blocked,
 * the next-closest is used; when every step is blocked, the creature waits.
 */
export function readFlowStep(
  field: FlowField,
  map: CityMap,
  from: Tile,
  isBlocked?: (tile: Tile) => boolean,
): Tile | null {
  if (field.origin === null) {
    return null;
  }
  const current = field.distances[from.y * map.width + from.x] ?? -1;
  if (current <= 0) {
    return null;
  }
  let best: Tile | null = null;
  let bestDistance = current;
  let bestIsOrthogonal = false;
  for (const [dx, dy] of FLOW_NEIGHBORS) {
    const next = { x: from.x + dx, y: from.y + dy };
    if (!isWalkableTile(map, next)) {
      continue;
    }
    if (dx !== 0 && dy !== 0 && blocksCorner(map, from.x, from.y, dx, dy)) {
      continue;
    }
    const distance = field.distances[next.y * map.width + next.x] ?? -1;
    if (distance < 0 || distance > bestDistance) {
      continue;
    }
    const orthogonal = dx === 0 || dy === 0;
    // The field is a breadth-first count of steps; on a tie, the orthogonal
    // step is preferred because it is the shorter animation (300 ms against
    // 424 ms of the diagonal), matching the weighted city path.
    if (distance === bestDistance && best !== null && (!orthogonal || bestIsOrthogonal)) {
      continue;
    }
    if (isBlocked !== undefined && isBlocked(next)) {
      continue;
    }
    best = next;
    bestDistance = distance;
    bestIsOrthogonal = orthogonal;
  }
  return best;
}

function buildFlowField(map: CityMap, origin: Tile): Int32Array {
  const size = map.width * map.height;
  const distances = new Int32Array(size).fill(-1);
  if (!isWalkableTile(map, origin)) {
    return distances;
  }
  const start = origin.y * map.width + origin.x;
  distances[start] = 0;
  const queue = new Uint32Array(size);
  let head = 0;
  let tail = 1;
  queue[0] = start;
  while (head < tail) {
    const key = queue[head] as number;
    head += 1;
    const x = key % map.width;
    const y = Math.floor(key / map.width);
    const nextDistance = (distances[key] as number) + 1;
    for (const [dx, dy] of FLOW_NEIGHBORS) {
      const next = { x: x + dx, y: y + dy };
      if (!isWalkableTile(map, next)) {
        continue;
      }
      if (dx !== 0 && dy !== 0 && blocksCorner(map, x, y, dx, dy)) {
        continue;
      }
      const nextKey = next.y * map.width + next.x;
      if (distances[nextKey] !== -1) {
        continue;
      }
      distances[nextKey] = nextDistance;
      queue[tail] = nextKey;
      tail += 1;
    }
  }
  return distances;
}

function blocksCorner(map: CityMap, x: number, y: number, dx: number, dy: number): boolean {
  return isSolidTile(tileAt(map, x + dx, y)) && isSolidTile(tileAt(map, x, y + dy));
}
