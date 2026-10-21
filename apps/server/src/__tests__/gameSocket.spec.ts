import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ServerMessage } from '@creatures/contracts/game';
import type { ServerWebSocket } from 'bun';

import { createConnectionRegistry } from '~/ws/connections';
import type { SocketData } from '~/ws/connections';
import { createGameSocketHandler, parseClientMessage } from '~/ws/gameSocket';

import { USER_ID, buildDependencies, buildEmptyAdmin } from './support';

const TRAINER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const REQ_ID = 'request-1';

function parsesPing(): void {
  const parsed = parseClientMessage(
    JSON.stringify({ sentAt: 123, type: 'ping', v: PROTOCOL_VERSION }),
  );
  expect(parsed).toEqual({ sentAt: 123, type: 'ping', v: PROTOCOL_VERSION });
}

function parsesSelectTrainer(): void {
  const parsed = parseClientMessage(
    JSON.stringify({
      reqId: REQ_ID,
      trainerId: TRAINER_ID,
      type: 'select_trainer',
      v: PROTOCOL_VERSION,
    }),
  );
  expect(parsed).toEqual({
    reqId: REQ_ID,
    trainerId: TRAINER_ID,
    type: 'select_trainer',
    v: PROTOCOL_VERSION,
  });
}

function parsesCommand(): void {
  const parsed = parseClientMessage(
    JSON.stringify({
      command: { creatureId: TRAINER_ID, type: 'swap_creature' },
      reqId: REQ_ID,
      type: 'command',
      v: PROTOCOL_VERSION,
    }),
  );
  expect(parsed).toEqual({
    command: { creatureId: TRAINER_ID, type: 'swap_creature' },
    reqId: REQ_ID,
    type: 'command',
    v: PROTOCOL_VERSION,
  });
}

function rejectsUnknownMessage(): void {
  expect(parseClientMessage(JSON.stringify({ type: 'nope', v: PROTOCOL_VERSION }))).toBeNull();
  expect(
    parseClientMessage(JSON.stringify({ sentAt: 'now', type: 'ping', v: PROTOCOL_VERSION })),
  ).toBeNull();
  expect(parseClientMessage('not json')).toBeNull();
  expect(
    parseClientMessage(
      JSON.stringify({ trainerId: 7, type: 'select_trainer', v: PROTOCOL_VERSION }),
    ),
  ).toBeNull();
  // An id that is not a uuid would make the database query itself fail, so it
  // never reaches the repository.
  expect(
    parseClientMessage(
      JSON.stringify({
        reqId: REQ_ID,
        trainerId: 'trainer-1',
        type: 'select_trainer',
        v: PROTOCOL_VERSION,
      }),
    ),
  ).toBeNull();
}

/**
 * A message of another version of the protocol is refused: the server does
 * not guess what the client meant.
 */
function rejectsAnotherVersion(): void {
  expect(parseClientMessage(JSON.stringify({ sentAt: 123, type: 'ping', v: 2 }))).toBeNull();
  expect(parseClientMessage(JSON.stringify({ sentAt: 123, type: 'ping' }))).toBeNull();
  expect(
    parseClientMessage(
      JSON.stringify({ reqId: REQ_ID, trainerId: TRAINER_ID, type: 'select_trainer', v: 0 }),
    ),
  ).toBeNull();
}

/**
 * A message that expects an answer without a request id cannot be answered.
 */
function rejectsMessageWithoutRequestId(): void {
  expect(
    parseClientMessage(JSON.stringify({ trainerId: TRAINER_ID, type: 'select_trainer', v: 1 })),
  ).toBeNull();
  expect(
    parseClientMessage(
      JSON.stringify({ reqId: '', trainerId: TRAINER_ID, type: 'select_trainer', v: 1 }),
    ),
  ).toBeNull();
  expect(
    parseClientMessage(
      JSON.stringify({ reqId: 7, trainerId: TRAINER_ID, type: 'select_trainer', v: 1 }),
    ),
  ).toBeNull();
  expect(
    parseClientMessage(
      JSON.stringify({ command: { type: 'finalize_hunt' }, type: 'command', v: 1 }),
    ),
  ).toBeNull();
}

/**
 * A command that is not understood is refused, and never guessed.
 */
function rejectsUnknownCommand(): void {
  expect(
    parseClientMessage(
      JSON.stringify({ command: { type: 'teleport' }, reqId: REQ_ID, type: 'command', v: 1 }),
    ),
  ).toBeNull();
  expect(
    parseClientMessage(
      JSON.stringify({
        command: { slot: 9, type: 'use_ability' },
        reqId: REQ_ID,
        type: 'command',
        v: 1,
      }),
    ),
  ).toBeNull();
}

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
 * A command of the hunt is refused with one message too, and the connection
 * stays open.
 */
function refusesACommandWithOneMessage(): Promise<void> {
  const deps = buildDependencies();
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

test('parseClientMessage reads a ping', parsesPing);
test('parseClientMessage reads a select_trainer', parsesSelectTrainer);
test('parseClientMessage reads a command', parsesCommand);
test('parseClientMessage rejects unknown messages', rejectsUnknownMessage);
test('parseClientMessage rejects another version of the protocol', rejectsAnotherVersion);
test('parseClientMessage rejects a message without request id', rejectsMessageWithoutRequestId);
test('parseClientMessage rejects an unknown command', rejectsUnknownCommand);
test('the failure of a command is one message', answersTheFailureWithOneMessage);
test('a refused command is one message', refusesACommandWithOneMessage);
test('an invalid message is one error', answersAnInvalidMessageWithOneError);
