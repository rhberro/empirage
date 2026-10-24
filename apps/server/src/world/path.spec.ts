import { expect, test } from 'bun:test';

import { TILE } from '@creatures/contracts/world';
import type { CityMap, Tile, TileId } from '@creatures/contracts/world';

import { findPath, MAX_PATH_STEPS, ORTHOGONAL_STEP_COST, DIAGONAL_STEP_COST } from '~/world/path';
import type { PathStep } from '~/world/path';

const FREE = TILE.GRASS;
const SOLID = TILE.TREE;

function buildMap(rows: string[]): CityMap {
  const height = rows.length;
  const width = rows[0].length;
  const tiles: TileId[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push(rows[y][x] === '#' ? SOLID : FREE);
    }
  }
  return {
    height,
    name: 'test',
    spawn: { x: 0, y: 0 },
    tiles,
    width,
  };
}

function readTile(map: CityMap, tile: Tile): TileId {
  return map.tiles[tile.y * map.width + tile.x];
}

function readCost(steps: PathStep[]): number {
  let total = 0;
  for (const step of steps) {
    const diagonal = step.from.x !== step.to.x && step.from.y !== step.to.y;
    total += diagonal ? DIAGONAL_STEP_COST : ORTHOGONAL_STEP_COST;
  }
  return total;
}

function isDiagonal(step: PathStep): boolean {
  return step.from.x !== step.to.x && step.from.y !== step.to.y;
}

/**
 * A wall in the middle is walked around, never through.
 */
test('the walk goes around a blocked line', function goesAround(): void {
  const map = buildMap(['.....', '.###.', '.....']);
  const found = findPath(map, { x: 0, y: 1 }, { x: 4, y: 1 });
  expect(found.ok).toBe(true);
  if (!found.ok) {
    return;
  }
  const first = found.steps.at(0);
  const last = found.steps.at(-1);
  expect(first?.from).toEqual({ x: 0, y: 1 });
  expect(last?.to).toEqual({ x: 4, y: 1 });
  expect(found.steps.length).toBeGreaterThanOrEqual(4);
  for (const step of found.steps) {
    expect(readTile(map, step.to)).toBe(FREE);
  }
});

/**
 * A diagonal between two solid orthogonals is a closed corner: the trainer
 * cannot squeeze through it.
 */
test('the walk does not cut a closed corner', function refusesCorner(): void {
  const map = buildMap(['.#', '#.']);
  const found = findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 });
  expect(found).toEqual({ code: 'tile_blocked', ok: false });
});

/**
 * A solid click resolves to the closest free square next to it, so the
 * trainer walks up to the tree instead of refusing the command.
 */
test('a solid target stops on the closest free neighbor', function stopsNextTo(): void {
  const map = buildMap(['.....', '..#..', '.....']);
  const target = { x: 2, y: 1 };
  const found = findPath(map, { x: 0, y: 0 }, target);
  expect(found.ok).toBe(true);
  if (!found.ok) {
    return;
  }
  const last = found.steps.at(-1);
  expect(last).toBeDefined();
  if (last === undefined) {
    return;
  }
  expect(last.to).not.toEqual(target);
  expect(readTile(map, last.to)).toBe(FREE);
  expect(Math.abs(last.to.x - target.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(last.to.y - target.y)).toBeLessThanOrEqual(1);
});

/**
 * Clicking a solid square that already borders the trainer is a stop: the
 * trainer is already on the closest free neighbor.
 */
test('a solid target next to the trainer is a stop', function stopsWhereItIs(): void {
  const map = buildMap(['...', '.#.', '...']);
  const found = findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 });
  expect(found).toEqual({ ok: true, steps: [] });
});

/**
 * A target with no free neighbor has nowhere to stop.
 */
test('a target walled in is refused', function refusesWalled(): void {
  const map = buildMap(['.....', '.###.', '.#.#.', '.###.', '.....']);
  const found = findPath(map, { x: 0, y: 0 }, { x: 2, y: 2 });
  expect(found).toEqual({ code: 'tile_blocked', ok: false });
});

/**
 * A target outside the map is not a blocked tile: the command itself is
 * invalid.
 */
test('a target outside the map is invalid', function refusesOutside(): void {
  const map = buildMap(['...', '...', '...']);
  const found = findPath(map, { x: 0, y: 0 }, { x: 9, y: 0 });
  expect(found).toEqual({ code: 'invalid_target', ok: false });
});

/**
 * A walk longer than the limit is refused with the same code as an invalid
 * target, instead of traveling as a huge answer.
 */
test('a walk longer than the limit is refused', function refusesLongWalk(): void {
  const row = '.'.repeat(MAX_PATH_STEPS + 2);
  const map = buildMap([row]);
  const found = findPath(map, { x: 0, y: 0 }, { x: MAX_PATH_STEPS + 1, y: 0 });
  expect(found).toEqual({ code: 'invalid_target', ok: false });
});

/**
 * A click on the square the trainer already stands on is a stop, not a walk.
 */
test('the walk to the current tile is empty', function staysPut(): void {
  const map = buildMap(['...', '...', '...']);
  const found = findPath(map, { x: 1, y: 1 }, { x: 1, y: 1 });
  expect(found).toEqual({ ok: true, steps: [] });
});

/**
 * Clicking three squares to the left must not produce a diagonal staircase:
 * three orthogonal steps cost three, while any diagonal detour costs more.
 */
test('three tiles to the left are three orthogonal steps', function walksLeft(): void {
  const map = buildMap(['.......', '.......', '.......']);
  const found = findPath(map, { x: 3, y: 1 }, { x: 0, y: 1 });
  expect(found.ok).toBe(true);
  if (!found.ok) {
    return;
  }
  expect(found.steps).toHaveLength(3);
  for (const step of found.steps) {
    expect(step.dir).toBe('left');
    expect(isDiagonal(step)).toBe(false);
  }
  expect(readCost(found.steps)).toBe(3 * ORTHOGONAL_STEP_COST);
});

/**
 * The weighted search prefers the four orthogonal steps over a pair of
 * diagonals, because the diagonal costs three each.
 */
test('the walk prefers the orthogonals when both are possible', function prefersOrthogonals(): void {
  const map = buildMap(['...', '...', '...']);
  const found = findPath(map, { x: 0, y: 0 }, { x: 2, y: 2 });
  expect(found.ok).toBe(true);
  if (!found.ok) {
    return;
  }
  expect(found.steps).toHaveLength(4);
  for (const step of found.steps) {
    expect(isDiagonal(step)).toBe(false);
  }
  expect(readCost(found.steps)).toBe(4 * ORTHOGONAL_STEP_COST);
  expect(readCost(found.steps)).toBeLessThan(2 * DIAGONAL_STEP_COST);
});

/**
 * A diagonal is used when the cheapest walk would not fit the answer limit:
 * the step-minimal walk keeps a far click legal instead of refusing it.
 */
test('a diagonal is used when it keeps the walk inside the limit', function usesDiagonal(): void {
  const row = '.'.repeat(512);
  const map = buildMap([row, row, row]);
  const found = findPath(map, { x: 0, y: 0 }, { x: 511, y: 2 });
  expect(found.ok).toBe(true);
  if (!found.ok) {
    return;
  }
  expect(found.steps.length).toBe(511);
  expect(found.steps.length).toBeLessThanOrEqual(MAX_PATH_STEPS);
  expect(found.steps.some(isDiagonal)).toBe(true);
  expect(found.steps.at(-1)?.to).toEqual({ x: 511, y: 2 });
});

/**
 * A dynamically occupied square is removed from the search, so the walk goes
 * around the actor instead of stopping at the first blocked tile.
 */
test('the walk routes around a dynamically blocked tile', function detours(): void {
  const map = buildMap(['.....', '.....', '.....']);
  const blocked = new Set(['2,1']);
  const found = findPath(
    map,
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    function isBlocked(tile: Tile): boolean {
      return blocked.has(`${tile.x},${tile.y}`);
    },
  );
  expect(found.ok).toBe(true);
  if (!found.ok) {
    return;
  }
  expect(
    found.steps.some(function enters(tile: PathStep): boolean {
      return tile.to.x === 2 && tile.to.y === 1;
    }),
  ).toBe(false);
  expect(found.steps.at(-1)?.to).toEqual({ x: 4, y: 1 });
});

/**
 * A target occupied by an actor resolves to a free neighbor, the same rule the
 * terrain uses for a solid click.
 */
test('a dynamically blocked target stops on a free neighbor', function stopsNearActor(): void {
  const map = buildMap(['...', '...', '...']);
  const found = findPath(
    map,
    { x: 0, y: 0 },
    { x: 2, y: 2 },
    function isTarget(tile: Tile): boolean {
      return tile.x === 2 && tile.y === 2;
    },
  );
  expect(found.ok).toBe(true);
  if (!found.ok) {
    return;
  }
  const last = found.steps.at(-1);
  expect(last).toBeDefined();
  if (last === undefined) {
    return;
  }
  expect(last.to).not.toEqual({ x: 2, y: 2 });
  expect(Math.abs(last.to.x - 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(last.to.y - 2)).toBeLessThanOrEqual(1);
});

/**
 * The city never passes the callback, so the result has to be exactly the one
 * the terrain-only search produced before the option existed.
 */
test('the search with nothing blocked is unchanged', function noDynamicBlock(): void {
  const map = buildMap(['###..', '.....', '..##.']);
  const plain = findPath(map, { x: 0, y: 1 }, { x: 4, y: 1 });
  const nothingBlocked = findPath(
    map,
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    function isBlocked(): boolean {
      return false;
    },
  );
  expect(nothingBlocked).toEqual(plain);
});
