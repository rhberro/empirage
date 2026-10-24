import { expect, test } from 'bun:test';

import { TILE } from '@creatures/contracts/world';
import type { CityMap, TileId } from '@creatures/contracts/world';

import { createWorldRegistry } from '~/world/registry';
import type { WorldRegistry } from '~/world/registry';
import {
  createWorldRuler,
  DIAGONAL_STEP_MS,
  ORTHOGONAL_STEP_MS,
  stepDurationMs,
} from '~/world/ruler';

const USER = 'user-1';
const TRAINER = 'trainer-1';

type Fixture = {
  clock: { now: () => number; set: (value: number) => void };
  registry: WorldRegistry;
  ruler: ReturnType<typeof createWorldRuler>;
};

function readGrass(): TileId {
  return TILE.GRASS;
}

function buildMap(): CityMap {
  const width = 10;
  const height = 10;
  const tiles: TileId[] = Array.from({ length: width * height }, readGrass);
  return {
    height,
    name: 'test',
    spawn: { x: 0, y: 0 },
    tiles,
    width,
  };
}

function buildFixture(): Fixture {
  let value = 1_000;
  const clock = {
    now: function now(): number {
      return value;
    },
    set: function set(next: number): void {
      value = next;
    },
  };
  const map = buildMap();
  const registry = createWorldRegistry(map, { now: clock.now });
  registry.join(USER, { gender: 'male', name: 'Rafa', trainerId: TRAINER }, clock.now());
  return { clock, registry, ruler: createWorldRuler(registry, map) };
}

/**
 * The orthogonal and the diagonal have their own durations, and the diagonal
 * takes longer.
 */
test('a step has the duration of its direction', function stampsDurations(): void {
  const fixture = buildFixture();
  const [orthogonal] = fixture.ruler.move(USER, 'ortho', { x: 1, y: 0 }).path;
  expect(orthogonal.endsAt - orthogonal.startsAt).toBe(ORTHOGONAL_STEP_MS);
  expect(stepDurationMs({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(DIAGONAL_STEP_MS);
  expect(DIAGONAL_STEP_MS).toBeGreaterThan(ORTHOGONAL_STEP_MS);
});

/**
 * The timestamps are absolute and cumulative: each step starts when the
 * previous ends.
 */
test('the timestamps grow along the path', function stampsChronologically(): void {
  const fixture = buildFixture();
  const result = fixture.ruler.move(USER, 'req-1', { x: 3, y: 0 });
  expect(result.ok).toBe(true);
  expect(result.path).toHaveLength(3);
  expect(result.path[0].startsAt).toBe(1_000);
  for (let index = 0; index < result.path.length; index += 1) {
    const segment = result.path[index];
    expect(segment.endsAt).toBeGreaterThan(segment.startsAt);
    if (index > 0) {
      expect(segment.startsAt).toBe(result.path[index - 1].endsAt);
    }
  }
});

/**
 * A move in the middle of a step keeps that step and plans the rest from the
 * tile it is entering, so the client never sees the animation restart.
 */
test('a move in the middle of a step keeps the first segment', function keepsStep(): void {
  const fixture = buildFixture();
  const first = fixture.ruler.move(USER, 'first', { x: 5, y: 0 });
  expect(first.path).toHaveLength(5);

  fixture.clock.set(1_100);
  const second = fixture.ruler.move(USER, 'second', { x: 2, y: 0 });
  expect(second.ok).toBe(true);
  expect(second.path[0]).toEqual(first.path[0]);
  expect(second.path[1].from).toEqual({ x: 1, y: 0 });
  expect(second.path[1].startsAt).toBe(first.path[0].endsAt);
  expect(second.path.at(-1)?.to).toEqual({ x: 2, y: 0 });
});

/**
 * Three quick clicks all keep the same first segment, until the clock ends
 * it; only then the walk starts from the confirmed tile.
 */
test('quick clicks keep the same first segment until it ends', function keepsThroughClicks(): void {
  const fixture = buildFixture();
  const firstSegment = fixture.ruler.move(USER, 'one', { x: 5, y: 0 }).path[0];

  fixture.clock.set(1_050);
  expect(fixture.ruler.move(USER, 'two', { x: 4, y: 0 }).path[0]).toEqual(firstSegment);
  fixture.clock.set(1_100);
  expect(fixture.ruler.move(USER, 'three', { x: 3, y: 0 }).path[0]).toEqual(firstSegment);
  fixture.clock.set(1_299);
  expect(fixture.ruler.move(USER, 'four', { x: 3, y: 0 }).path[0]).toEqual(firstSegment);

  fixture.clock.set(1_300);
  const afterFirst = fixture.ruler.move(USER, 'five', { x: 3, y: 0 });
  expect(afterFirst.path[0].from).toEqual({ x: 1, y: 0 });
});

/**
 * The tile the trainer is entering is already the destination: the answer is
 * only the step in course.
 */
test('a move to the tile in course returns only the current segment', function stopsAtStepEnd(): void {
  const fixture = buildFixture();
  const first = fixture.ruler.move(USER, 'walk', { x: 5, y: 0 });

  fixture.clock.set(1_100);
  const answer = fixture.ruler.move(USER, 'stop', { x: 1, y: 0 });
  expect(answer.ok).toBe(true);
  expect(answer.path).toEqual([first.path[0]]);

  fixture.clock.set(2_000);
  const actor = fixture.registry.actor(USER, fixture.clock.now());
  expect(actor?.position).toEqual({ x: 1, y: 0 });
  expect(actor?.segment).toBeUndefined();
});

/**
 * A failed replan does not cut the step in course: the trainer finishes it
 * and stops there.
 */
test('a failed replan keeps the step in course', function keepsOnFailure(): void {
  const fixture = buildFixture();
  fixture.ruler.move(USER, 'walk', { x: 5, y: 0 });

  fixture.clock.set(1_100);
  const failed = fixture.ruler.move(USER, 'broken', { x: 99, y: 0 });
  expect(failed.ok).toBe(false);
  expect(failed.code).toBe('invalid_target');
  expect(failed.path).toEqual([]);

  fixture.clock.set(1_400);
  const arrived = fixture.registry.actor(USER, fixture.clock.now());
  expect(arrived?.position).toEqual({ x: 1, y: 0 });
  expect(arrived?.segment).toBeUndefined();

  fixture.clock.set(2_500);
  expect(fixture.registry.actor(USER, fixture.clock.now())?.position).toEqual({ x: 1, y: 0 });
});

/**
 * A move to the current tile with no step in course is a stop.
 */
test('a move to the current tile stops the walk', function stops(): void {
  const fixture = buildFixture();
  const stopped = fixture.ruler.move(USER, 'stop', { x: 0, y: 0 });
  expect(stopped.ok).toBe(true);
  expect(stopped.path).toEqual([]);
  expect(stopped.worldRev).toBe(1);
});

/**
 * A repeated request id repeats the original answer, even if the clock moved
 * and a fresh plan would start from another tile.
 */
test('a repeated reqId repeats the original path', function dedups(): void {
  const fixture = buildFixture();
  const first = fixture.ruler.move(USER, 'req-1', { x: 2, y: 0 });
  expect(first.path).toHaveLength(2);

  fixture.clock.set(1_500);
  const repeated = fixture.ruler.move(USER, 'req-1', { x: 2, y: 0 });
  expect(repeated.path).toEqual(first.path);

  const fresh = fixture.ruler.move(USER, 'req-2', { x: 2, y: 0 });
  expect(fresh.path[0].from).toEqual({ x: 1, y: 0 });
  expect(fresh.path).toHaveLength(1);
});

/**
 * The target outside the map carries its own code.
 */
test('the failure of a target carries the reason', function refusesTarget(): void {
  const fixture = buildFixture();
  const outside = fixture.ruler.move(USER, 'out', { x: 99, y: 0 });
  expect(outside.ok).toBe(false);
  expect(outside.code).toBe('invalid_target');
});

/**
 * A command from an account that is not in the world is refused without
 * touching the registry.
 */
test('a move without a trainer is refused', function refusesUnknownUser(): void {
  const fixture = buildFixture();
  const answer = fixture.ruler.move('stranger', 'req-1', { x: 1, y: 0 });
  expect(answer.ok).toBe(false);
  expect(answer.code).toBe('invalid_command');
});
