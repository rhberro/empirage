import { expect, test } from 'bun:test';

import type { PathSegment } from '@creatures/contracts/world';

import {
  computeActorAnimation,
  directionToPose,
  IDLE_LOOP_MS,
} from '~/entities/world/model/actorState';

function buildSegment(startsAt: number, endsAt: number): PathSegment {
  return {
    dir: 'right',
    endsAt,
    from: { x: 0, y: 0 },
    startsAt,
    to: { x: 1, y: 0 },
  };
}

/**
 * The eight directions collapse to the four poses of the atlas.
 */
test('the eight directions map to four poses', function directionsMapToPoses(): void {
  expect(directionToPose('up')).toBe('up');
  expect(directionToPose('upRight')).toBe('up');
  expect(directionToPose('upLeft')).toBe('up');
  expect(directionToPose('down')).toBe('down');
  expect(directionToPose('downRight')).toBe('down');
  expect(directionToPose('downLeft')).toBe('down');
  expect(directionToPose('left')).toBe('left');
  expect(directionToPose('right')).toBe('right');
});

/**
 * Idle cycles two frames on the clock, one loop per eight hundred milliseconds.
 */
test('idle cycles two frames on the clock', function idleCyclesTwoFrames(): void {
  expect(computeActorAnimation('down', undefined, 0).frame).toBe(0);
  expect(computeActorAnimation('down', undefined, 400).frame).toBe(1);
  expect(computeActorAnimation('down', undefined, 800).frame).toBe(0);
  expect(computeActorAnimation('down', undefined, 1200).frame).toBe(1);
  expect(computeActorAnimation('down', undefined, IDLE_LOOP_MS * 3).frame).toBe(0);
});

/**
 * An idle actor keeps its pose.
 */
test('idle keeps the facing pose', function idleKeepsPose(): void {
  const animation = computeActorAnimation('upRight', undefined, 0);
  expect(animation.pose).toBe('up');
  expect(animation.state).toBe('idle');
});

/**
 * Walking spreads four frames over the step, from the first to the last.
 */
test('walking spreads four frames over the step', function walkSpreadsFrames(): void {
  const segment = buildSegment(0, 400);
  expect(computeActorAnimation('right', segment, 0).frame).toBe(0);
  expect(computeActorAnimation('right', segment, 100).frame).toBe(1);
  expect(computeActorAnimation('right', segment, 200).frame).toBe(2);
  expect(computeActorAnimation('right', segment, 300).frame).toBe(3);
  expect(computeActorAnimation('right', segment, 399).frame).toBe(3);
});

/**
 * Walking reports the walking state, and a step that is over reports idle.
 */
test('walking reports its state and turns idle at the end', function walkStateTurnsIdle(): void {
  const segment = buildSegment(0, 400);
  expect(computeActorAnimation('right', segment, 200).state).toBe('walking');
  expect(computeActorAnimation('right', segment, 400).state).toBe('idle');
  expect(computeActorAnimation('right', segment, -1).state).toBe('idle');
});
