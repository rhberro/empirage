import { expect, test } from 'bun:test';

import type { CityMap, PathSegment } from '@creatures/contracts/world';
import { TILE } from '@creatures/contracts/world';

import {
  buildPrediction,
  mergeMoveResult,
  readOrigin,
  sameStep,
} from '~/entities/world/model/prediction';

const MAP: CityMap = {
  height: 10,
  name: 'Test',
  spawn: { x: 1, y: 1 },
  tiles: Array.from({ length: 100 }, function grass(): typeof TILE.GRASS {
    return TILE.GRASS;
  }),
  width: 10,
};

function buildSegment(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  startsAt: number,
  endsAt: number,
): PathSegment {
  return {
    dir: 'right',
    endsAt,
    from: { x: fromX, y: fromY },
    startsAt,
    to: { x: toX, y: toY },
  };
}

test('the origin of an idle actor is the confirmed tile', function idleOrigin(): void {
  expect(readOrigin({ path: [], you: { position: { x: 4, y: 5 } } }, 1000)).toEqual({ x: 4, y: 5 });
});

test('the origin of a walking actor is the tile it is entering', function walkingOrigin(): void {
  const segment = buildSegment(1, 1, 2, 1, 900, 1200);
  expect(readOrigin({ path: [segment], you: { position: { x: 1, y: 1 } } }, 1000)).toEqual({
    x: 2,
    y: 1,
  });
});

test('predicts the first step from the confirmed tile', function predictsFirstStep(): void {
  const prediction = buildPrediction({
    map: MAP,
    now: 1000,
    state: { path: [], you: { position: { x: 1, y: 1 } } },
    target: { x: 3, y: 1 },
  });
  expect(prediction).toEqual(buildSegment(1, 1, 2, 1, 1000, 1300));
});

test('predicts the step after the one in course', function predictsAfterCurrent(): void {
  const current = buildSegment(1, 1, 2, 1, 900, 1200);
  const prediction = buildPrediction({
    map: MAP,
    now: 1000,
    state: { path: [current], you: { position: { x: 1, y: 1 } } },
    target: { x: 4, y: 1 },
  });
  expect(prediction).toEqual(buildSegment(2, 1, 3, 1, 1200, 1500));
});

test('does not predict a click on the tile the actor is already on', function noPredictionOnSameTile(): void {
  const prediction = buildPrediction({
    map: MAP,
    now: 1000,
    state: { path: [], you: { position: { x: 1, y: 1 } } },
    target: { x: 1, y: 1 },
  });
  expect(prediction).toBeNull();
});

test('keeps the predicted step and shifts the rest of the answer', function keepsPrediction(): void {
  const prediction = buildSegment(1, 1, 2, 1, 1000, 1300);
  const serverPath = [buildSegment(1, 1, 2, 1, 1100, 1400), buildSegment(2, 1, 3, 1, 1400, 1700)];
  const merged = mergeMoveResult(prediction, serverPath);
  expect(merged[0]).toEqual(prediction);
  expect(merged[1]).toEqual(buildSegment(2, 1, 3, 1, 1300, 1600));
});

test('starts the predicted step after the step the server preserved', function waitsForCurrent(): void {
  const current = buildSegment(0, 1, 1, 1, 900, 1200);
  const prediction = buildSegment(1, 1, 2, 1, 1000, 1300);
  const serverPath = [
    current,
    buildSegment(1, 1, 2, 1, 1200, 1500),
    buildSegment(2, 1, 3, 1, 1500, 1800),
  ];
  const merged = mergeMoveResult(prediction, serverPath);
  expect(merged[0]).toEqual(current);
  expect(merged[1]).toEqual(buildSegment(1, 1, 2, 1, 1200, 1500));
  expect(merged[2]).toEqual(buildSegment(2, 1, 3, 1, 1500, 1800));
});

test('takes the answer whole when the server planned another first step', function differentStep(): void {
  const prediction = buildSegment(1, 1, 2, 1, 1000, 1300);
  const serverPath = [buildSegment(1, 1, 1, 2, 1000, 1300)];
  expect(mergeMoveResult(prediction, serverPath)).toEqual(serverPath);
});

test('takes the answer whole when there was no prediction', function noPrediction(): void {
  const serverPath = [buildSegment(1, 1, 2, 1, 1000, 1300)];
  expect(mergeMoveResult(null, serverPath)).toEqual(serverPath);
});

test('the identity of a step ignores the timing', function identity(): void {
  expect(sameStep(buildSegment(1, 1, 2, 1, 0, 1), buildSegment(1, 1, 2, 1, 50, 350))).toBe(true);
  expect(sameStep(buildSegment(1, 1, 2, 1, 0, 1), buildSegment(1, 1, 2, 2, 0, 1))).toBe(false);
});
