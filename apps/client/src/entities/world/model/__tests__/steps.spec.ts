import { expect, test } from 'bun:test';

import type { PathSegment } from '@creatures/contracts/world';

import { computeActorPosition, resolveSegment } from '~/entities/world/model/steps';

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

/**
 * With no walk, the actor is on its confirmed tile.
 */
test('an empty walk snaps to the confirmed tile', function emptyWalkSnaps(): void {
  const position = computeActorPosition([], 500, { x: 7, y: 3 });
  expect(position).toEqual({ x: 112, y: 48 });
});

/**
 * Before the first step, the actor is on the start tile.
 */
test('before the walk the actor is on the start', function beforeWalkIsOnStart(): void {
  const segment = buildSegment(1, 1, 2, 1, 100, 400);
  expect(computeActorPosition([segment], 50, { x: 1, y: 1 })).toEqual({ x: 16, y: 16 });
  expect(computeActorPosition([segment], 100, { x: 1, y: 1 })).toEqual({ x: 16, y: 16 });
});

/**
 * In the middle of a step, the actor is between the tiles, on a whole pixel.
 */
test('a step in course interpolates whole pixels', function stepInterpolates(): void {
  const segment = buildSegment(0, 0, 1, 0, 0, 300);
  expect(computeActorPosition([segment], 150, { x: 0, y: 0 })).toEqual({ x: 8, y: 0 });
});

/**
 * A diagonal step moves sixteen pixels on each axis.
 */
test('a diagonal step moves on both axes', function diagonalMovesBothAxes(): void {
  const segment = { ...buildSegment(0, 0, 1, 1, 0, 424), dir: 'downRight' as const };
  expect(computeActorPosition([segment], 212, { x: 0, y: 0 })).toEqual({ x: 8, y: 8 });
});

/**
 * After the walk, the actor is fixed on the last tile.
 */
test('after the walk the actor is on the end', function afterWalkIsOnEnd(): void {
  const segment = buildSegment(1, 1, 2, 1, 100, 400);
  expect(computeActorPosition([segment], 400, { x: 1, y: 1 })).toEqual({ x: 32, y: 16 });
  expect(computeActorPosition([segment], 9000, { x: 1, y: 1 })).toEqual({ x: 32, y: 16 });
});

/**
 * The position switches to the next segment when the time crosses it.
 */
test('a walk switches segments by the clock', function walkSwitchesSegments(): void {
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 1, 1, 300, 600);
  const path = [first, second];
  expect(computeActorPosition(path, 150, { x: 0, y: 0 })).toEqual({ x: 8, y: 0 });
  expect(computeActorPosition(path, 450, { x: 0, y: 0 })).toEqual({ x: 16, y: 8 });
});

/**
 * A hidden tab returns after the whole walk and snaps to the end tile.
 */
test('a late clock snaps to the end of the walk', function lateClockSnaps(): void {
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 2, 0, 300, 600);
  const position = computeActorPosition([first, second], 100_000, { x: 0, y: 0 });
  expect(position).toEqual({ x: 32, y: 0 });
});

/**
 * The segment in course is the one that covers the time; there is none before
 * and after the walk.
 */
test('the segment in course is resolved by the clock', function resolvesSegment(): void {
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 1, 1, 300, 600);
  const path = [first, second];
  expect(resolveSegment(path, 150)).toBe(first);
  expect(resolveSegment(path, 450)).toBe(second);
  expect(resolveSegment(path, -1)).toBeUndefined();
  expect(resolveSegment(path, 700)).toBeUndefined();
});
