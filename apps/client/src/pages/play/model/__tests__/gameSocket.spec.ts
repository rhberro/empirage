import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';

import { connectGameSocket } from '~/pages/play/model/gameSocket';

import {
  BASE_URL,
  buildActor,
  buildHandlers,
  buildSegment,
  installFakeSocket,
  TICKET,
  waitFor,
  WAIT_MS,
} from './gameSocketFixture';

/**
 * The ticket opens the channel, and the token of the account does not travel
 * in the address.
 */
test('the ticket opens the channel', function buildsUrl(): void {
  const fake = installFakeSocket();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: buildHandlers().handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  expect(fake.sockets[0].url).toBe(`wss://api.example.com/ws?ticket=${TICKET}`);
  fake.restore();
});

/**
 * The client tells the server which trainer it is, and the answer is
 * matched by the request that it carries.
 */
test('the client selects the trainer with a request id', function selectsTrainer(): void {
  const fake = installFakeSocket();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: buildHandlers().handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  const sent = fake.sockets[0].sent;
  expect(sent.length).toBe(1);
  const message = JSON.parse(sent[0]);
  expect(message.type).toBe('select_trainer');
  expect(message.trainerId).toBe('trainer-1');
  expect(message.v).toBe(PROTOCOL_VERSION);
  expect(typeof message.reqId).toBe('string');
  fake.restore();
});

/**
 * A message of another version is refused with clarity, and the connection
 * stays open: one broken message does not kill the channel.
 */
test('a message of another version does not kill the channel', function refusesVersion(): void {
  const fake = installFakeSocket();
  const record = buildHandlers();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('message', {
    data: JSON.stringify({ sentAt: 1, type: 'pong', v: PROTOCOL_VERSION + 1 }),
  });
  expect(record.errors.length).toBe(1);
  expect(record.closed.length).toBe(0);
  fake.restore();
});

/**
 * A connection that the server stops answering is a dead connection: the
 * client closes it and says that the server went quiet.
 */
test('the silence of the server kills the connection', function killsConnection(): Promise<void> {
  const fake = installFakeSocket();
  const record = buildHandlers();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    livenessTimeoutMs: 10,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  return waitFor(WAIT_MS).then(function assertSilence(): void {
    expect(record.errors.length).toBe(1);
    expect(record.closed.length).toBe(1);
    fake.restore();
  });
});

/**
 * The messages of the world are dispatched to the handlers: the channel does
 * not know what the world does with them.
 */
test('the world messages reach the handlers', function dispatchesWorld(): void {
  const fake = installFakeSocket();
  const record = buildHandlers();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  fake.sockets[0].emit('message', {
    data: JSON.stringify({
      actors: [buildActor('other', 4, 5)],
      type: 'world_state',
      v: PROTOCOL_VERSION,
      worldRev: 3,
      you: buildActor('you', 1, 2),
    }),
  });
  fake.sockets[0].emit('message', {
    data: JSON.stringify({
      ok: true,
      path: [buildSegment(1, 2)],
      reqId: 'req-1',
      type: 'move_result',
      v: PROTOCOL_VERSION,
      worldRev: 4,
    }),
  });
  expect(record.worlds.length).toBe(1);
  expect(record.worlds[0].worldRev).toBe(3);
  expect(record.moved.length).toBe(1);
  expect(record.moved[0].path.length).toBe(1);
  fake.restore();
});
