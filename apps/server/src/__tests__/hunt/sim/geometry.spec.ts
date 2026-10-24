import { expect, test } from 'bun:test';

import { TILE } from '@creatures/contracts/world';

import { LINE_ABILITY, START, buildContent } from '~/__tests__/hunt/sim/fixtures';
import {
  areaTiles,
  chebyshev,
  directionBetween,
  neighbors8,
  stepDuration,
  waveTiles,
} from '~/hunt/sim/geometry';
import type { SimAbility } from '~/hunt/sim/types';

const CIRCLE: SimAbility = {
  areaLength: null,
  areaRadius: 1,
  areaShape: 'circle',
  areaStepMs: 200,
  cooldownMs: 5000,
  damage: 10,
  element: 'neutral',
  name: 'Circle',
  range: 5,
  slug: 'circle',
  targetType: 'area',
  travelMs: 0,
};

function theLineReachesEveryTileInTime(): void {
  const content = buildContent({ spawns: [] });
  const tiles = waveTiles(LINE_ABILITY, { x: 5, y: 5 }, { x: 9, y: 5 }, content.map, START);
  expect(tiles.map(readEntryX)).toEqual([6, 7, 8, 9]);
  expect(tiles.map(readArrival)).toEqual([START + 200, START + 400, START + 600, START + 800]);
}

function theLineStopsAtASolidTile(): void {
  const content = buildContent({ spawns: [] });
  content.map.tiles[5 * content.map.width + 7] = TILE.TREE;
  const tiles = areaTiles(LINE_ABILITY, { x: 5, y: 5 }, { x: 9, y: 5 }, content.map);
  expect(tiles.map(readTileX)).toEqual([6]);
}

function theCircleIsCentredOnTheTarget(): void {
  const content = buildContent({ spawns: [] });
  const tiles = waveTiles(CIRCLE, { x: 5, y: 5 }, { x: 5, y: 5 }, content.map, START);
  expect(tiles.length).toBe(5);
  expect(tiles.map(readArrival)).toEqual([
    START + 200,
    START + 200,
    START,
    START + 200,
    START + 200,
  ]);
}

function theDistanceAndTheDirectionsAreExact(): void {
  expect(chebyshev({ x: 1, y: 1 }, { x: 4, y: 2 })).toBe(3);
  expect(directionBetween({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe('downRight');
  expect(stepDuration({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(300);
  expect(stepDuration({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(424);
}

function theEightNeighborsAreStable(): void {
  expect(neighbors8({ x: 5, y: 5 })).toEqual([
    { x: 5, y: 4 },
    { x: 6, y: 4 },
    { x: 6, y: 5 },
    { x: 6, y: 6 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 5 },
    { x: 4, y: 4 },
  ]);
}

function readEntryX(tile: { tile: { x: number } }): number {
  return tile.tile.x;
}

function readArrival(tile: { arrivalAt: number }): number {
  return tile.arrivalAt;
}

function readTileX(tile: { x: number }): number {
  return tile.x;
}

test('the line reaches every tile in time', theLineReachesEveryTileInTime);
test('the line stops at a solid tile', theLineStopsAtASolidTile);
test('the circle is centred on the target', theCircleIsCentredOnTheTarget);
test('the distance and the directions are exact', theDistanceAndTheDirectionsAreExact);
test('the eight neighbors are stable', theEightNeighborsAreStable);
