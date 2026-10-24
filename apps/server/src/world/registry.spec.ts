import { expect, test } from 'bun:test';

import { TILE } from '@creatures/contracts/world';
import type { CityMap, PathSegment, TileId } from '@creatures/contracts/world';

import { createWorldRegistry, MOVE_CACHE_TTL_MS } from '~/world/registry';
import type { MoveOutcome, StepConfirmation } from '~/world/registry';

const USER = 'user-1';
const OTHER = 'user-2';

function readGrass(): TileId {
  return TILE.GRASS;
}

function buildMap(): CityMap {
  const width = 8;
  const height = 8;
  const tiles: TileId[] = Array.from({ length: width * height }, readGrass);
  return {
    height,
    name: 'test',
    spawn: { x: 2, y: 2 },
    tiles,
    width,
  };
}

function buildClock(): { now: () => number; set: (value: number) => void } {
  let value = 1_000;
  return {
    now: function now(): number {
      return value;
    },
    set: function set(next: number): void {
      value = next;
    },
  };
}

function buildSegment(startsAt: number): PathSegment {
  return {
    dir: 'right',
    endsAt: startsAt + 300,
    from: { x: 2, y: 2 },
    startsAt,
    to: { x: 3, y: 2 },
  };
}

/**
 * The revision of the world is monotonic per observer, and two observers do
 * not share a counter.
 */
test('worldRev is monotonic per observer', function readsRevisions(): void {
  const clock = buildClock();
  const registry = createWorldRegistry(buildMap(), { now: clock.now });
  expect(registry.nextWorldRev(USER)).toBe(1);
  expect(registry.nextWorldRev(USER)).toBe(2);
  expect(registry.nextWorldRev(OTHER)).toBe(1);
  expect(registry.nextWorldRev(USER)).toBe(3);
});

/**
 * The first join puts the actor at the spawn; the next one returns to the
 * tile the actor had when it left.
 */
test('join spawns once and keeps the tile afterwards', function keepsTile(): void {
  const clock = buildClock();
  const registry = createWorldRegistry(buildMap(), { now: clock.now });
  const profile = { gender: 'male' as const, name: 'Rafa', trainerId: 'trainer-1' };
  const first = registry.join(USER, profile, clock.now());
  expect(first.position).toEqual({ x: 2, y: 2 });
  expect(first.dir).toBe('down');

  const segment = buildSegment(clock.now());
  registry.setPath(USER, [segment], clock.now());
  clock.set(1_500);
  registry.leave(USER, clock.now());
  expect(registry.presentIds()).toEqual([]);

  clock.set(2_000);
  const again = registry.join(USER, profile, clock.now());
  expect(again.position).toEqual({ x: 3, y: 2 });
});

/**
 * A step whose end the clock already passed is confirmed the next time the
 * actor is read, without a tick moving the world.
 */
test('advance confirms the steps the clock ended', function confirmsByClock(): void {
  const clock = buildClock();
  const registry = createWorldRegistry(buildMap(), { now: clock.now });
  const profile = { gender: 'female' as const, name: 'Bia', trainerId: 'trainer-2' };
  registry.join(USER, profile, clock.now());
  registry.setPath(USER, [buildSegment(clock.now())], clock.now());

  clock.set(1_100);
  const walking = registry.actor(USER, clock.now());
  expect(walking?.position).toEqual({ x: 2, y: 2 });
  expect(walking?.segment?.dir).toBe('right');

  clock.set(1_300);
  const arrived = registry.actor(USER, clock.now());
  expect(arrived?.position).toEqual({ x: 3, y: 2 });
  expect(arrived?.segment).toBeUndefined();
});

/**
 * A repeated request id is answered from the cache inside the window.
 */
test('a repeated reqId is answered from the cache', function dedups(): void {
  const clock = buildClock();
  const registry = createWorldRegistry(buildMap(), { now: clock.now });
  const outcome: MoveOutcome = { ok: true, path: [buildSegment(clock.now())], reqId: 'req-1' };
  registry.cacheMove(USER, 'req-1', outcome, clock.now());
  expect(registry.readCachedMove(USER, 'req-1', clock.now())).toEqual(outcome);

  clock.set(1_000 + MOVE_CACHE_TTL_MS);
  expect(registry.readCachedMove(USER, 'req-1', clock.now())).toBeUndefined();
});

/**
 * The cache belongs to the account: the same request id of another account is
 * another request.
 */
test('the cache is per account', function separatesAccounts(): void {
  const clock = buildClock();
  const registry = createWorldRegistry(buildMap(), { now: clock.now });
  const outcome: MoveOutcome = { ok: true, path: [], reqId: 'req-1' };
  registry.cacheMove(USER, 'req-1', outcome, clock.now());
  expect(registry.readCachedMove(OTHER, 'req-1', clock.now())).toBeUndefined();
});

/**
 * A join with a persisted start puts the trainer on that square and facing
 * the saved direction, even when the account was already known.
 */
test('join uses the provided start', function usesStart(): void {
  const clock = buildClock();
  const registry = createWorldRegistry(buildMap(), { now: clock.now });
  const profile = {
    gender: 'male' as const,
    name: 'Rafa',
    start: { facing: 'left' as const, x: 4, y: 4 },
    trainerId: 'trainer-1',
  };
  const first = registry.join(USER, profile, clock.now());
  expect(first.position).toEqual({ x: 4, y: 4 });
  expect(first.dir).toBe('left');

  const again = registry.join(
    USER,
    { ...profile, start: { facing: 'up' as const, x: 6, y: 6 } },
    clock.now(),
  );
  expect(again.position).toEqual({ x: 6, y: 6 });
  expect(again.dir).toBe('up');
});

/**
 * The disconnect path completes the step in course regardless of the clock,
 * so a reconnect never rewinds half a step.
 */
test('completeStep lands on the step in course', function completesStep(): void {
  const clock = buildClock();
  const registry = createWorldRegistry(buildMap(), { now: clock.now });
  registry.join(
    USER,
    { gender: 'male' as const, name: 'Rafa', trainerId: 'trainer-1' },
    clock.now(),
  );
  registry.setPath(USER, [buildSegment(clock.now())], clock.now());

  clock.set(1_100);
  const actor = registry.completeStep(USER, clock.now());
  expect(actor?.position).toEqual({ x: 3, y: 2 });
  expect(actor?.segment).toBeUndefined();
  expect(registry.trainerId(USER)).toBe('trainer-1');
});

/**
 * Each confirmed step carries the trainer and the new square, which is what
 * the write-behind persists.
 */
test('a confirmed step is reported with the trainer', function reportsStep(): void {
  const clock = buildClock();
  const confirmations: StepConfirmation[] = [];
  const registry = createWorldRegistry(buildMap(), {
    now: clock.now,
    onStepConfirmed: function collect(confirmation): void {
      confirmations.push(confirmation);
    },
  });
  registry.join(
    USER,
    { gender: 'male' as const, name: 'Rafa', trainerId: 'trainer-1' },
    clock.now(),
  );
  registry.setPath(USER, [buildSegment(clock.now())], clock.now());

  clock.set(1_300);
  registry.actor(USER, clock.now());
  expect(confirmations).toHaveLength(1);
  expect(confirmations[0]).toMatchObject({
    actorId: USER,
    dir: 'right',
    position: { x: 3, y: 2 },
    trainerId: 'trainer-1',
  });
});
