import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ServerMessage } from '@creatures/contracts/game';
import { isWalkableTile } from '@creatures/contracts/world';
import type { Tile } from '@creatures/contracts/world';
import type { ServerWebSocket } from 'bun';

import type { ServerDependencies } from '~/dependencies';
import { CITY_MAP } from '~/world/map';
import { ORTHOGONAL_STEP_MS } from '~/world/ruler';
import type { SocketData } from '~/ws/connections';
import { createGameSocketHandler } from '~/ws/gameSocket';

import { OTHER_USER_ID, USER_ID, buildDependencies, buildTrainerAdmin } from './support';

const TRAINER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const REQ_ID = 'request-1';

/**
 * The channel of the test: it keeps the messages the server sent.
 */
type FakeSocket = {
  sent: ServerMessage[];
  socket: ServerWebSocket<SocketData>;
};

function closeChannel(): void {
  // the channel of the test is never closed by the runtime
}

function buildFakeSocket(userId: string): FakeSocket {
  const sent: ServerMessage[] = [];
  const data: SocketData = { userId };
  const socket = {
    close: closeChannel,
    data,
    send: function send(payload: string): void {
      sent.push(JSON.parse(payload) as ServerMessage);
    },
  } as unknown as ServerWebSocket<SocketData>;
  return { sent, socket };
}

function flush(): Promise<void> {
  return new globalThis.Promise(function wait(resolve): void {
    setTimeout(resolve, 0);
  });
}

/**
 * The channel under test, with the world wired to the same connection
 * registry the handler uses: the broadcaster looks sockets up by account.
 */
type GameHarness = {
  deps: ServerDependencies;
  fake: FakeSocket;
  handler: GameHandler;
};

/**
 * The handler with the methods the runtime always provides.
 *
 * Bun declares `message`, `open` and `close` as optional in the handler type,
 * which would force a call guard in every test; the handler built here always
 * has all of them.
 */
type GameHandler = {
  close(ws: ServerWebSocket<SocketData>, code: number, reason: string): void;
  message(ws: ServerWebSocket<SocketData>, raw: string | Buffer): void;
  open(ws: ServerWebSocket<SocketData>): void;
};

function buildGame(userId: string = USER_ID): GameHarness {
  const deps = buildDependencies({ admin: buildTrainerAdmin(TRAINER_ID, userId) });
  const handler = createGameSocketHandler(deps, deps.connections) as GameHandler;
  const fake = buildFakeSocket(userId);
  handler.open(fake.socket);
  return { deps, fake, handler };
}

function sendSelectTrainer(handler: GameHandler, fake: FakeSocket): void {
  handler.message(
    fake.socket,
    JSON.stringify({
      reqId: REQ_ID,
      trainerId: TRAINER_ID,
      type: 'select_trainer',
      v: PROTOCOL_VERSION,
    }),
  );
}

function sendMove(handler: GameHandler, fake: FakeSocket, reqId: string, target: Tile): void {
  handler.message(
    fake.socket,
    JSON.stringify({
      command: { target, type: 'move' },
      reqId,
      type: 'command',
      v: PROTOCOL_VERSION,
    }),
  );
}

function lastMessageOfType<T extends ServerMessage['type']>(
  sent: ServerMessage[],
  type: T,
): Extract<ServerMessage, { type: T }> | undefined {
  for (let index = sent.length - 1; index >= 0; index -= 1) {
    const message = sent[index];
    if (message.type === type) {
      return message as Extract<ServerMessage, { type: T }>;
    }
  }
  return undefined;
}

function chebyshev(left: Tile, right: Tile): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function sendsTheWorldStateAfterSelect(): Promise<void> {
  const game = buildGame();
  sendSelectTrainer(game.handler, game.fake);
  return flush().then(function assertMessages(): void {
    expect(game.fake.sent).toHaveLength(2);
    const [answer, world] = game.fake.sent;
    expect(answer).toMatchObject({ ok: true, reqId: REQ_ID, type: 'command_result' });
    expect(world.type).toBe('world_state');
    if (world.type === 'world_state') {
      expect(world.you.actorId).toBe(USER_ID);
      expect(world.you.position).toEqual(CITY_MAP.spawn);
      expect(world.actors).toEqual([]);
      expect(world.worldRev).toBe(1);
    }
  });
}

function answersTheWalkWithOneResult(): Promise<void> {
  const game = buildGame();
  sendSelectTrainer(game.handler, game.fake);
  return flush()
    .then(function afterSelect(): Promise<void> {
      game.fake.sent.length = 0;
      const target = { x: CITY_MAP.spawn.x, y: CITY_MAP.spawn.y + 1 };
      expect(isWalkableTile(CITY_MAP, target)).toBe(true);
      sendMove(game.handler, game.fake, 'move-1', target);
      return flush();
    })
    .then(function assertMessages(): void {
      expect(game.fake.sent).toHaveLength(1);
      const answer = game.fake.sent[0];
      expect(answer.type).toBe('move_result');
      if (answer.type === 'move_result') {
        expect(answer.ok).toBe(true);
        expect(answer.reqId).toBe('move-1');
        expect(answer.path).toHaveLength(1);
        const [step] = answer.path;
        expect(step.from).toEqual(CITY_MAP.spawn);
        expect(step.to).toEqual({ x: CITY_MAP.spawn.x, y: CITY_MAP.spawn.y + 1 });
        expect(step.dir).toBe('down');
        expect(step.endsAt - step.startsAt).toBe(ORTHOGONAL_STEP_MS);
      }
    });
}

function stopsNextToASolidSquare(): Promise<void> {
  const game = buildGame();
  sendSelectTrainer(game.handler, game.fake);
  return flush()
    .then(function afterSelect(): Promise<void> {
      game.fake.sent.length = 0;
      const well = { x: 52, y: 29 };
      expect(isWalkableTile(CITY_MAP, well)).toBe(false);
      sendMove(game.handler, game.fake, 'move-well', well);
      return flush();
    })
    .then(function assertMessages(): void {
      const answer = game.fake.sent[0];
      expect(answer.type).toBe('move_result');
      if (answer.type === 'move_result') {
        expect(answer.ok).toBe(true);
        expect(answer.path.length).toBeGreaterThan(0);
        const last = answer.path.at(-1);
        expect(last).toBeDefined();
        if (last !== undefined) {
          expect(isWalkableTile(CITY_MAP, last.to)).toBe(true);
          expect(chebyshev(last.to, { x: 52, y: 29 })).toBe(1);
        }
      }
    });
}

function refusesATargetOutsideTheMap(): Promise<void> {
  const game = buildGame();
  sendSelectTrainer(game.handler, game.fake);
  return flush()
    .then(function afterSelect(): Promise<void> {
      game.fake.sent.length = 0;
      sendMove(game.handler, game.fake, 'move-outside', { x: -1, y: 0 });
      return flush();
    })
    .then(function assertMessages(): void {
      const answer = game.fake.sent[0];
      expect(answer.type).toBe('move_result');
      if (answer.type === 'move_result') {
        expect(answer.ok).toBe(false);
        expect(answer.code).toBe('invalid_target');
        expect(answer.path).toEqual([]);
      }
    });
}

function replaysTheSameWalk(): Promise<void> {
  const game = buildGame();
  sendSelectTrainer(game.handler, game.fake);
  return flush()
    .then(function afterSelect(): Promise<void> {
      game.fake.sent.length = 0;
      const target = { x: CITY_MAP.spawn.x, y: CITY_MAP.spawn.y + 1 };
      sendMove(game.handler, game.fake, 'move-repeat', target);
      return flush();
    })
    .then(function repeat(): Promise<void> {
      sendMove(game.handler, game.fake, 'move-repeat', {
        x: CITY_MAP.spawn.x + 1,
        y: CITY_MAP.spawn.y,
      });
      return flush();
    })
    .then(function assertMessages(): void {
      expect(game.fake.sent).toHaveLength(2);
      const [first, second] = game.fake.sent;
      expect(first.type).toBe('move_result');
      expect(second.type).toBe('move_result');
      if (first.type === 'move_result' && second.type === 'move_result') {
        // The retry receives the walk planned for the first answer, not a new
        // one from wherever the clock moved the actor since.
        expect(second.path).toEqual(first.path);
        expect(second.worldRev).toBeGreaterThan(first.worldRev);
      }
    });
}

function announcesTheOtherActorAndLeave(): Promise<void> {
  const deps = buildDependencies({ admin: buildTrainerAdmin(TRAINER_ID, USER_ID) });
  const handler = createGameSocketHandler(deps, deps.connections) as GameHandler;
  const first = buildFakeSocket(USER_ID);
  const second = buildFakeSocket(OTHER_USER_ID);
  handler.open(first.socket);
  handler.open(second.socket);
  sendSelectTrainer(handler, first);
  return flush()
    .then(function selectSecond(): Promise<void> {
      sendSelectTrainer(handler, second);
      return flush();
    })
    .then(function moveSecond(): Promise<void> {
      sendMove(handler, second, 'move-second', {
        x: CITY_MAP.spawn.x,
        y: CITY_MAP.spawn.y + 1,
      });
      return flush();
    })
    .then(function assertAnnouncement(): Promise<void> {
      const update = lastMessageOfType(first.sent, 'actor_update');
      expect(update?.actor.actorId).toBe(OTHER_USER_ID);
      handler.close(second.socket, 1000, 'test');
      return flush();
    })
    .then(function assertLeave(): void {
      const leave = lastMessageOfType(first.sent, 'actor_leave');
      expect(leave?.actorId).toBe(OTHER_USER_ID);
    });
}

test('select_trainer answers and then sends the world state', sendsTheWorldStateAfterSelect);
test('move answers with the walk and nothing else', answersTheWalkWithOneResult);
test('move into a solid square stops next to it', stopsNextToASolidSquare);
test('move outside the map is refused', refusesATargetOutsideTheMap);
test('a repeated request id is answered with the same walk', replaysTheSameWalk);
test('another actor is announced and its leave is announced', announcesTheOtherActorAndLeave);
