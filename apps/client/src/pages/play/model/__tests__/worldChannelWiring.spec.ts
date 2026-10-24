import { beforeEach, expect, test } from 'bun:test';

import type { ActorMedia, PathSegment } from '@creatures/contracts/world';

import { buildPlayerStateFixture } from '~/entities/team';
import { worldStore } from '~/entities/world';
import type { WorldStoreState } from '~/entities/world';
import { buildHandlers } from '~/pages/play/model/gameChannelHandlers';
import type { ChannelState } from '~/pages/play/model/gameChannelHandlers';
import type { ChannelMachine } from '~/pages/play/model/gameChannelMachine';
import type { CommandResult, MoveResult, WorldStateMessage } from '~/pages/play/model/gameProtocol';
import type { GameSocketHandlers } from '~/pages/play/model/gameSocket';

function buildActor(actorId: string, x: number, y: number, segment?: PathSegment): ActorMedia {
  return { actorId, dir: 'down', gender: 'male', name: actorId, position: { x, y }, segment };
}

function buildSegment(fromX: number, toX: number): PathSegment {
  return {
    dir: 'right',
    endsAt: 1300,
    from: { x: fromX, y: 4 },
    startsAt: 1000,
    to: { x: toX, y: 4 },
  };
}

function refuseMove(): Promise<never> {
  return Promise.reject(new Error('the test does not move'));
}

function refuseCommand(): Promise<CommandResult> {
  return Promise.reject(new Error('the test does not command'));
}

function buildMachine(): ChannelMachine {
  return {
    attempt: noop,
    cancelExpectedClose: noop,
    close: noop,
    expectServerClose: noop,
    reconnectNow: noop,
    requestCommand: refuseCommand,
    requestMove: refuseMove,
    retry: noop,
  };
}

function buildChannelState(): ChannelState {
  return {
    attempt: null,
    expectedClose: false,
    retries: 0,
    retryTimer: null,
    stabilityTimer: null,
    stableAttempt: null,
    stopped: false,
  };
}

function buildWorldHandlers(): GameSocketHandlers {
  return buildHandlers(
    { applySnapshot: noop, onLost: noop, onOpen: noop, onWarning: noop },
    buildChannelState(),
    { socket: null, suppressed: false },
    buildMachine(),
  );
}

function buildWorldState(
  worldRev: number,
  you: ActorMedia,
  actors: ActorMedia[],
): WorldStateMessage {
  return { actors, worldRev, you };
}

function readWorld(): WorldStoreState {
  return worldStore.getState();
}

function noop(): void {
  void 0;
}

beforeEach(function resetWorld(): void {
  worldStore.getState().resetWorld();
});

/**
 * The world that the channel pushes is the world the store holds.
 */
test('the world state reaches the store', function appliesWorldState(): void {
  buildWorldHandlers().onWorldState(
    buildWorldState(3, buildActor('you', 1, 1), [buildActor('other', 4, 5)]),
  );
  const world = readWorld();
  expect(world.worldRev).toBe(3);
  expect(world.you?.actorId).toBe('you');
  expect(world.actors.other.position).toEqual({ x: 4, y: 5 });
});

/**
 * A world that arrives late is old news: the revision says it, and the store
 * does not go back to where it was.
 */
test('an old world is discarded', function discardsOldWorld(): void {
  buildWorldHandlers().onWorldState(
    buildWorldState(5, buildActor('you', 2, 2), [buildActor('other', 4, 5)]),
  );
  buildWorldHandlers().onWorldState(buildWorldState(4, buildActor('you', 9, 9), []));
  const world = readWorld();
  expect(world.worldRev).toBe(5);
  expect(world.you?.position).toEqual({ x: 2, y: 2 });
});

/**
 * An actor that leaves the city goes out of the map of the world.
 */
test('the actor that leaves is removed', function removesActor(): void {
  const handlers = buildWorldHandlers();
  handlers.onWorldState(
    buildWorldState(5, buildActor('you', 1, 1), [
      buildActor('other', 4, 5),
      buildActor('third', 6, 7),
    ]),
  );
  handlers.onActorLeave({ actorId: 'other', worldRev: 6 });
  const world = readWorld();
  expect(world.worldRev).toBe(6);
  expect(world.actors.other).toBeUndefined();
  expect(world.actors.third.actorId).toBe('third');
});

/**
 * The answer of a move replaces the step of the player with the walk the
 * server planned: the first tile of the answer is the confirmed one.
 */
test('the move result replaces the walk of the player', function appliesMove(): void {
  const handlers = buildWorldHandlers();
  handlers.onWorldState(buildWorldState(2, buildActor('you', 1, 4), []));
  const path = [buildSegment(1, 2), buildSegment(2, 3)];
  const result: MoveResult = {
    code: null,
    ok: true,
    path,
    reqId: 'req-1',
    worldRev: 3,
  };
  handlers.onMoveResult(result);
  const world = readWorld();
  expect(world.worldRev).toBe(3);
  expect(world.you?.position).toEqual({ x: 1, y: 4 });
  expect(world.you?.segment).toEqual(path[0]);
  expect(world.path).toEqual(path);
});

/**
 * The snapshot is the reading of the clock that the world uses: the client
 * corrects the drift and no extra request is made for it.
 */
test('the snapshot corrects the clock of the world', function syncsClock(): void {
  const handlers = buildWorldHandlers();
  const serverNow = Date.now() + 10_000;
  handlers.onState(buildPlayerStateFixture({ serverNow }));
  expect(readWorld().serverNow).toBe(serverNow);
  expect(readWorld().now()).toBeGreaterThanOrEqual(serverNow);
});
