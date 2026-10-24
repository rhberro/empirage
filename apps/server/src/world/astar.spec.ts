import { expect, test } from 'bun:test';

import { TILE } from '@creatures/contracts/world';
import type { CityMap, Tile, TileId } from '@creatures/contracts/world';

import { findPathWithParams, MAP_DIAGONALWALKCOST, MAP_NORMALWALKCOST } from '~/world/path';
import type { FindPathParams } from '~/world/path';

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
  return { height, name: 'test', spawn: { x: 0, y: 0 }, tiles, width };
}

function chebyshev(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const DEFAULT_PARAMS: FindPathParams = {
  allowDiagonal: true,
  clearSight: false,
  fullPathSearch: true,
  keepDistance: false,
  maxSearchDist: 0,
  maxTargetDist: 1,
  minTargetDist: 1,
};

/**
 * The costs follow the Canary `AStarNodes`: ten orthogonal, thirty-five
 * diagonal, so a straight line stays cheaper than cutting the corner.
 */
test('the costs match the Canary A*', function costs(): void {
  expect(MAP_NORMALWALKCOST).toBe(10);
  expect(MAP_DIAGONALWALKCOST).toBe(35);
});

/**
 * The goal is a ring: the walk stops one square away from the target, not on
 * top of it.
 */
test('the ring target stops at distance one of the goal', function ringTarget(): void {
  const map = buildMap([
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
  ]);
  const target = { x: 5, y: 5 };
  const found = findPathWithParams(map, { x: 0, y: 0 }, target, DEFAULT_PARAMS);
  expect(found).not.toBeNull();
  if (found === null) {
    return;
  }
  const last = found.at(-1);
  expect(last).toBeDefined();
  if (last === undefined) {
    return;
  }
  expect(chebyshev(last.to, target)).toBe(1);
});

/**
 * The radius from the start bounds the search: a goal beyond `maxSearchDist`
 * is not reached.
 */
test('the search radius refuses a far goal', function radius(): void {
  const map = buildMap(['...........', '...........', '...........']);
  const found = findPathWithParams(
    map,
    { x: 0, y: 1 },
    { x: 10, y: 1 },
    { ...DEFAULT_PARAMS, maxSearchDist: 2 },
  );
  expect(found).toBeNull();
});

/**
 * A target that cannot be reached at all (walled in, exact tile) is refused
 * instead of returning a wrong square.
 */
test('an unreachable goal is refused', function unreachable(): void {
  const map = buildMap(['.....', '.###.', '.#.#.', '.###.', '.....']);
  const found = findPathWithParams(
    map,
    { x: 0, y: 0 },
    { x: 2, y: 2 },
    { ...DEFAULT_PARAMS, maxTargetDist: 0, minTargetDist: 0 },
  );
  expect(found).toBeNull();
});

/**
 * A goal inside the ring is a stop, without a search.
 */
test('a goal inside the ring is a stop', function alreadyThere(): void {
  const map = buildMap(['...', '...', '...']);
  const found = findPathWithParams(
    map,
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { ...DEFAULT_PARAMS, minTargetDist: 0 },
  );
  expect(found).toEqual([]);
});
