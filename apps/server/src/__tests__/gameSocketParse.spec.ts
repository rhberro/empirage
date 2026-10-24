import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';

import { parseClientMessage } from '~/ws/gameSocket';

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

test('parseClientMessage reads a ping', parsesPing);
test('parseClientMessage reads a select_trainer', parsesSelectTrainer);
test('parseClientMessage reads a command', parsesCommand);
test('parseClientMessage rejects unknown messages', rejectsUnknownMessage);
test('parseClientMessage rejects another version of the protocol', rejectsAnotherVersion);
test('parseClientMessage rejects a message without request id', rejectsMessageWithoutRequestId);
test('parseClientMessage rejects an unknown command', rejectsUnknownCommand);
