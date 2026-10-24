import { expect, test } from 'bun:test';

import type { ActorMedia, PathSegment } from '@creatures/contracts/world';

import { createWorldStore } from '~/entities/world';
import { computeActorPosition } from '~/entities/world/model/steps';

function buildActor(actorId: string, x: number, y: number): ActorMedia {
  return { actorId, dir: 'down', gender: 'female', name: actorId, position: { x, y } };
}

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
 * The world of a connection starts empty: there is no actor to draw and no
 * revision to beat.
 */
test('a new world is empty', function startsEmpty(): void {
  const store = createWorldStore();
  expect(store.getState().you).toBeNull();
  expect(store.getState().actors).toEqual({});
  expect(store.getState().worldRev).toBe(-1);
});

/**
 * The revision of the world only moves forward: an update that arrives late
 * does not put the world back.
 */
test('an old update is discarded', function discardsOldUpdate(): void {
  const store = createWorldStore();
  store.getState().applyWorldState({
    actors: [buildActor('other', 4, 5)],
    worldRev: 7,
    you: buildActor('you', 1, 1),
  });
  store.getState().applyActorUpdate({ actor: buildActor('other', 9, 9), worldRev: 6 });
  expect(store.getState().actors.other.position).toEqual({ x: 4, y: 5 });
  expect(store.getState().worldRev).toBe(7);
});

/**
 * An update of the actor of the connection also updates the player, and the
 * step it carries is the walk in course.
 */
test('an update of the player updates the walk', function updatesPlayer(): void {
  const store = createWorldStore();
  store.getState().applyWorldState({
    actors: [],
    worldRev: 1,
    you: buildActor('you', 1, 1),
  });
  const segment = {
    dir: 'right' as const,
    endsAt: 400,
    from: { x: 1, y: 1 },
    startsAt: 100,
    to: { x: 2, y: 1 },
  };
  store.getState().applyActorUpdate({
    actor: { ...buildActor('you', 2, 1), dir: 'right', segment },
    worldRev: 2,
  });
  expect(store.getState().you?.position).toEqual({ x: 2, y: 1 });
  expect(store.getState().path).toEqual([segment]);
});

/**
 * The answer of an older move is old news: the revision says it, and the newer
 * walk stays on screen instead of being replaced by a request that already
 * lost. An answer with the revision already applied is old news as well.
 */
test('an old move result is discarded', function discardsOldMove(): void {
  const store = createWorldStore();
  store.getState().applyWorldState({
    actors: [],
    worldRev: 3,
    you: buildActor('you', 1, 1),
  });
  const newest = [buildSegment(1, 1, 2, 1, 100, 400)];
  store.getState().applyMoveResult({ ok: true, path: newest, worldRev: 4 });
  const stale = [buildSegment(9, 9, 8, 9, 100, 400)];
  store.getState().applyMoveResult({ ok: true, path: stale, worldRev: 3 });
  store.getState().applyMoveResult({ ok: true, path: stale, worldRev: 4 });
  expect(store.getState().path).toEqual(newest);
  expect(store.getState().you?.position).toEqual({ x: 1, y: 1 });
  expect(store.getState().worldRev).toBe(4);
});

/**
 * An answer that replans a step already on screen carries its original
 * timestamps. The walk is continuous: the confirmed tile is where the step
 * started, and the pixel comes from the clock, not from the moment the answer
 * arrived.
 */
test('a walk that started in the past keeps the position continuous', function keepsPastWalk(): void {
  const store = createWorldStore();
  store.getState().applyWorldState({
    actors: [],
    worldRev: 1,
    you: buildActor('you', 0, 0),
  });
  const at = Date.now();
  const inCourse = buildSegment(0, 0, 1, 0, at - 150, at + 150);
  store.getState().applyMoveResult({ ok: true, path: [inCourse], worldRev: 2 });

  const readAt = store.getState().now();
  const position = store.getState().you?.position;
  expect(position).toEqual({ x: 0, y: 0 });
  const pixel = computeActorPosition(store.getState().path, readAt, position ?? { x: 0, y: 0 });
  expect(pixel.y).toBe(0);
  expect(pixel.x).toBeGreaterThan(0);
  expect(pixel.x).toBeLessThan(16);

  const next = buildSegment(1, 0, 2, 0, at + 150, at + 450);
  store.getState().applyMoveResult({ ok: true, path: [inCourse, next], worldRev: 3 });
  const before = computeActorPosition([inCourse], readAt, position ?? { x: 0, y: 0 });
  const after = computeActorPosition(
    store.getState().path,
    readAt,
    store.getState().you?.position ?? { x: 0, y: 0 },
  );
  expect(after).toEqual(before);
  expect(store.getState().you?.position).toEqual({ x: 0, y: 0 });
});

/**
 * Three clicks leave three answers in flight and they can arrive out of
 * order: only the newest revision reaches the screen.
 */
test('the newest of three quick answers wins', function keepsNewestAnswer(): void {
  const store = createWorldStore();
  store.getState().applyWorldState({
    actors: [],
    worldRev: 1,
    you: buildActor('you', 0, 0),
  });
  const first = [buildSegment(0, 0, 1, 0, 100, 400)];
  const second = [buildSegment(3, 3, 4, 3, 100, 400)];
  const third = [buildSegment(7, 7, 8, 7, 100, 400)];
  store.getState().applyMoveResult({ ok: true, path: first, worldRev: 10 });
  store.getState().applyMoveResult({ ok: true, path: third, worldRev: 12 });
  store.getState().applyMoveResult({ ok: true, path: second, worldRev: 11 });
  expect(store.getState().path).toEqual(third);
  expect(store.getState().you?.position).toEqual({ x: 7, y: 7 });
  expect(store.getState().worldRev).toBe(12);
});

/**
 * The clock of the world is the clock of the server, corrected by the
 * snapshot: the client does not trust its own clock.
 */
test('the clock follows the server', function followsServer(): void {
  const store = createWorldStore();
  const serverNow = Date.now() + 60_000;
  store.getState().syncServerTime(serverNow);
  expect(store.getState().now()).toBeGreaterThanOrEqual(serverNow);
});

/**
 * A trainer switch or a lost connection throws the world away: the next
 * connection gets the world from the server again.
 */
test('the reset forgets the world and the clock', function resetsWorld(): void {
  const store = createWorldStore();
  store.getState().syncServerTime(Date.now() + 60_000);
  store.getState().applyWorldState({
    actors: [buildActor('other', 4, 5)],
    worldRev: 3,
    you: buildActor('you', 1, 1),
  });
  store.getState().applyMoveResult({
    ok: true,
    path: [buildSegment(1, 1, 2, 1, 100, 400)],
    worldRev: 4,
  });
  store.getState().resetWorld();
  expect(store.getState().actors).toEqual({});
  expect(store.getState().path).toEqual([]);
  expect(store.getState().you).toBeNull();
  expect(store.getState().worldRev).toBe(-1);
  expect(store.getState().serverNow).toBe(0);
  expect(store.getState().now()).toBeLessThan(Date.now() + 60_000);
});
