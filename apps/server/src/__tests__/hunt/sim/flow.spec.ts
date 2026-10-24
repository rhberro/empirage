import { expect, test } from 'bun:test';

import type { CityMap, Tile } from '@creatures/contracts/world';
import { TILE } from '@creatures/contracts/world';

import { createFlowField, readFlowField, readFlowStep } from '~/hunt/sim/flow';

function buildMap(solid: Tile[] = []): CityMap {
  const width = 10;
  const height = 10;
  const tiles = Array.from({ length: width * height }, function grass(): number {
    return TILE.GRASS;
  });
  for (const tile of solid) {
    tiles[tile.y * width + tile.x] = TILE.TREE;
  }
  return {
    height,
    name: 'Flow',
    spawn: { x: 1, y: 1 },
    tiles: tiles as CityMap['tiles'],
    width,
  };
}

test('the field points from a far tile toward the origin', function pointsToOrigin(): void {
  const map = buildMap();
  const field = createFlowField();
  const distances = readFlowField(field, map, { x: 1, y: 1 });
  expect(distances[1 * map.width + 1]).toBe(0);
  const step = readFlowStep(field, map, { x: 8, y: 8 });
  expect(step).not.toBeNull();
  if (step === null) {
    return;
  }
  const fromDistance = distances[8 * map.width + 8] as number;
  const stepDistance = distances[step.y * map.width + step.x] as number;
  expect(stepDistance).toBeLessThan(fromDistance);
});

test('the field routes around a wall', function routesAroundWall(): void {
  const wall: Tile[] = [];
  for (let y = 0; y < 9; y += 1) {
    wall.push({ x: 5, y });
  }
  const map = buildMap(wall);
  const field = createFlowField();
  readFlowField(field, map, { x: 9, y: 1 });
  const step = readFlowStep(field, map, { x: 1, y: 1 });
  expect(step).not.toBeNull();
  if (step === null) {
    return;
  }
  expect(step.x).not.toBe(5);
});

test('a blocked best step is skipped', function skipsBlockedStep(): void {
  const map = buildMap();
  const field = createFlowField();
  readFlowField(field, map, { x: 1, y: 1 });
  const step = readFlowStep(field, map, { x: 8, y: 8 }, function blocksEveryStep(): boolean {
    return true;
  });
  expect(step).toBeNull();
});

test('the field is reused for the same origin and rebuilt for a new one', function cachesField(): void {
  const map = buildMap();
  const field = createFlowField();
  const first = readFlowField(field, map, { x: 1, y: 1 });
  const same = readFlowField(field, map, { x: 1, y: 1 });
  const moved = readFlowField(field, map, { x: 2, y: 2 });
  expect(same).toBe(first);
  expect(moved).not.toBe(first);
});
