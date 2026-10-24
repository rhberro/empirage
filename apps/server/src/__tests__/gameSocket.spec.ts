import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ServerMessage } from '@creatures/contracts/game';
import type { HuntSnapshot } from '@creatures/contracts/huntSim';
import type { ServerWebSocket } from 'bun';

import { createConnectionRegistry } from '~/ws/connections';
import type { SocketData } from '~/ws/connections';
import { createGameSocketHandler } from '~/ws/gameSocket';

import {
  USER_ID,
  buildDependencies,
  buildEmptyAdmin,
  buildHuntSnapshot,
  buildNoopHuntManager,
  buildTrainerAdmin,
} from './support';

const TRAINER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const REQ_ID = 'request-1';

/**
 * The channel of the test: it keeps the messages the server sent.
 */
type FakeSocket = {
  sent: ServerMessage[];
  socket: ServerWebSocket<SocketData>;
};

/**
 * The channel of the test is never closed.
 */
function closeChannel(): void {
  // nothing to close
}

function buildFakeSocket(): FakeSocket {
  const sent: ServerMessage[] = [];
  const data: SocketData = { userId: USER_ID };
  const socket = {
    close: closeChannel,
    data,
    send: function send(payload: string): void {
      sent.push(JSON.parse(payload) as ServerMessage);
    },
  } as unknown as ServerWebSocket<SocketData>;
  return { sent, socket };
}

/**
 * The failure of a command is one message: the answer of the command, with
 * the code of the reason.
 */
function answersTheFailureWithOneMessage(): Promise<void> {
  const deps = buildDependencies({ admin: buildEmptyAdmin() });
  const handler = createGameSocketHandler(deps, createConnectionRegistry());
  const fake = buildFakeSocket();
  const raw = JSON.stringify({
    reqId: REQ_ID,
    trainerId: TRAINER_ID,
    type: 'select_trainer',
    v: PROTOCOL_VERSION,
  });
  handler.message(fake.socket, raw);
  return flush().then(function assertMessages(): void {
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toEqual({
      code: 'trainer_not_found',
      ok: false,
      reqId: REQ_ID,
      rev: 0,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    });
  });
}

/**
 * A command of the hunt is applied and answered with one message, and the
 * connection stays open.
 */
function finalizesTheHunt(): Promise<void> {
  const finalized: string[] = [];
  const deps = buildDependencies({
    hunts: buildNoopHuntManager({
      finalize: function finalize(trainerId: string): Promise<void> {
        finalized.push(trainerId);
        return Promise.resolve();
      },
    }),
  });
  deps.sessions.set(USER_ID, TRAINER_ID);
  const handler = createGameSocketHandler(deps, createConnectionRegistry());
  const fake = buildFakeSocket();
  const raw = JSON.stringify({
    command: { type: 'finalize_hunt' },
    reqId: REQ_ID,
    type: 'command',
    v: PROTOCOL_VERSION,
  });
  handler.message(fake.socket, raw);
  return flush().then(function assertMessages(): void {
    expect(finalized).toEqual([TRAINER_ID]);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toEqual({
      ok: true,
      reqId: REQ_ID,
      rev: 0,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    });
  });
}

/**
 * The swap goes to the manager; the answer says whether the creature is able
 * to fight.
 */
function swapsTheActiveCreature(): Promise<void> {
  const swaps: { creatureId: string; trainerId: string }[] = [];
  const deps = buildDependencies({
    hunts: buildNoopHuntManager({
      swap: function swap(trainerId: string, creatureId: string): Promise<boolean> {
        swaps.push({ creatureId, trainerId });
        return Promise.resolve(true);
      },
    }),
  });
  deps.sessions.set(USER_ID, TRAINER_ID);
  const handler = createGameSocketHandler(deps, createConnectionRegistry());
  const fake = buildFakeSocket();
  const raw = JSON.stringify({
    command: { creatureId: TRAINER_ID, type: 'swap_creature' },
    reqId: REQ_ID,
    type: 'command',
    v: PROTOCOL_VERSION,
  });
  handler.message(fake.socket, raw);
  return flush().then(function assertMessages(): void {
    expect(swaps).toEqual([{ creatureId: TRAINER_ID, trainerId: TRAINER_ID }]);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toEqual({
      ok: true,
      reqId: REQ_ID,
      rev: 0,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    });
  });
}

/**
 * A creature that is not in the team, or is dead, is refused by the manager
 * and the client receives the refusal of the command.
 */
function refusesAnInvalidSwap(): Promise<void> {
  const deps = buildDependencies();
  deps.sessions.set(USER_ID, TRAINER_ID);
  const handler = createGameSocketHandler(deps, createConnectionRegistry());
  const fake = buildFakeSocket();
  const raw = JSON.stringify({
    command: { creatureId: TRAINER_ID, type: 'swap_creature' },
    reqId: REQ_ID,
    type: 'command',
    v: PROTOCOL_VERSION,
  });
  handler.message(fake.socket, raw);
  return flush().then(function assertMessages(): void {
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toEqual({
      code: 'invalid_command',
      ok: false,
      reqId: REQ_ID,
      rev: 0,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    });
  });
}

/**
 * The player never uses an ability by hand: the rotation belongs to the
 * simulation.
 */
function refusesAManualAbility(): Promise<void> {
  const deps = buildDependencies();
  deps.sessions.set(USER_ID, TRAINER_ID);
  const handler = createGameSocketHandler(deps, createConnectionRegistry());
  const fake = buildFakeSocket();
  const raw = JSON.stringify({
    command: { slot: 0, type: 'use_ability' },
    reqId: REQ_ID,
    type: 'command',
    v: PROTOCOL_VERSION,
  });
  handler.message(fake.socket, raw);
  return flush().then(function assertMessages(): void {
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toEqual({
      code: 'invalid_command',
      ok: false,
      reqId: REQ_ID,
      rev: 0,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    });
  });
}

/**
 * The selection sends the hunt of the trainer after the answer of the command
 * and the world: the client receives the state it missed while disconnected.
 */
function sendsTheHuntStateAfterSelect(): Promise<void> {
  const huntSnapshot = buildHuntSnapshot();
  const deps = buildDependencies({
    admin: buildTrainerAdmin(TRAINER_ID, USER_ID),
    hunts: buildNoopHuntManager({
      snapshot: function snapshot(): Promise<HuntSnapshot> {
        return Promise.resolve(huntSnapshot);
      },
    }),
  });
  const handler = createGameSocketHandler(deps, deps.connections);
  const fake = buildFakeSocket();
  handler.open?.(fake.socket);
  handler.message(
    fake.socket,
    JSON.stringify({
      reqId: REQ_ID,
      trainerId: TRAINER_ID,
      type: 'select_trainer',
      v: PROTOCOL_VERSION,
    }),
  );
  return flush().then(function assertMessages(): void {
    const types = fake.sent.map(readMessageType);
    expect(types).toEqual(['command_result', 'world_state', 'hunt_state']);
    const hunt = fake.sent[2];
    expect(hunt).toEqual({ ...huntSnapshot, type: 'hunt_state', v: PROTOCOL_VERSION });
  });
}

function readMessageType(message: ServerMessage): string {
  return message.type;
}

/**
 * A message of the protocol that belongs to no request is refused with one
 * error alone, without the answer of a command.
 */
function answersAnInvalidMessageWithOneError(): Promise<void> {
  const deps = buildDependencies();
  const handler = createGameSocketHandler(deps, createConnectionRegistry());
  const fake = buildFakeSocket();
  const raw = JSON.stringify({ type: 'nope', v: PROTOCOL_VERSION });
  handler.message(fake.socket, raw);
  return flush().then(function assertMessages(): void {
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toEqual({
      code: 'invalid_message',
      message: 'Mensagem inválida.',
      type: 'error',
      v: PROTOCOL_VERSION,
    });
  });
}

/**
 * Waits for the queue of promises of the channel to answer.
 */
function flush(): Promise<void> {
  return new globalThis.Promise(function wait(resolve): void {
    setTimeout(resolve, 0);
  });
}

test('the failure of a command is one message', answersTheFailureWithOneMessage);
test('a finalization is one message', finalizesTheHunt);
test('a swap goes to the manager', swapsTheActiveCreature);
test('an invalid swap is refused', refusesAnInvalidSwap);
test('a manual ability is refused', refusesAManualAbility);
test('the selection sends the hunt state', sendsTheHuntStateAfterSelect);
test('an invalid message is one error', answersAnInvalidMessageWithOneError);
