import { expect, test } from 'bun:test';

import type { PathSegment } from '@creatures/contracts/world';

import { ATTACK_MS, computeCreatureAnimation } from '~/entities/hunt/model/creatureAnimation';

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
 * Idle breathes in two frames on the clock.
 */
test('idle cycles two frames', function idleCyclesTwoFrames(): void {
  expect(computeCreatureAnimation({ castAt: null, dir: 'down', now: 0 }).frame).toBe(0);
  expect(computeCreatureAnimation({ castAt: null, dir: 'down', now: 400 }).frame).toBe(1);
  expect(computeCreatureAnimation({ castAt: null, dir: 'down', now: 800 }).frame).toBe(0);
});

/**
 * Walking spreads four frames over the step.
 */
test('walking spreads four frames over the step', function walkSpreadsFrames(): void {
  const segment = buildSegment(0, 400);
  expect(computeCreatureAnimation({ castAt: null, dir: 'right', now: 0, segment }).frame).toBe(0);
  expect(computeCreatureAnimation({ castAt: null, dir: 'right', now: 100, segment }).frame).toBe(1);
  expect(computeCreatureAnimation({ castAt: null, dir: 'right', now: 300, segment }).frame).toBe(3);
  expect(computeCreatureAnimation({ castAt: null, dir: 'right', now: 200, segment }).state).toBe(
    'walk',
  );
});

/**
 * A diagonal direction keeps the vertical pose of its column.
 */
test('a diagonal direction uses the vertical pose', function diagonalUsesVerticalPose(): void {
  expect(computeCreatureAnimation({ castAt: null, dir: 'upRight', now: 0 }).pose).toBe('up');
  expect(computeCreatureAnimation({ castAt: null, dir: 'downLeft', now: 0 }).pose).toBe('down');
});

/**
 * A recent cast plays two strike frames, and the attack takes over the walk.
 */
test('a cast plays the attack and then ends', function castPlaysAttack(): void {
  const castAt = 1000;
  const first = computeCreatureAnimation({ castAt, dir: 'right', now: castAt });
  expect(first.state).toBe('attack');
  expect(first.frame).toBe(0);
  const second = computeCreatureAnimation({ castAt, dir: 'right', now: castAt + 200 });
  expect(second.state).toBe('attack');
  expect(second.frame).toBe(1);
  const after = computeCreatureAnimation({ castAt, dir: 'right', now: castAt + ATTACK_MS });
  expect(after.state).toBe('idle');
});
