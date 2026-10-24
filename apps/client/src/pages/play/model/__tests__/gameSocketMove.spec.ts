import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';

import { connectGameSocket } from '~/pages/play/model/gameSocket';

import {
  BASE_URL,
  buildHandlers,
  buildSegment,
  installFakeSocket,
  readRejection,
  TICKET,
} from './gameSocketFixture';

/**
 * A move goes out as a command with a request id, and the answer that carries
 * that id settles the promise.
 */
test('the move is sent and answered by request id', function answersMove(): Promise<void> {
  const fake = installFakeSocket();
  const record = buildHandlers();
  const channel = connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  const answer = channel.requestMove({ x: 1, y: 2 });
  const message = JSON.parse(fake.sockets[0].sent[1]);
  expect(message.type).toBe('command');
  expect(message.command).toEqual({ target: { x: 1, y: 2 }, type: 'move' });
  expect(message.v).toBe(PROTOCOL_VERSION);
  fake.sockets[0].emit('message', {
    data: JSON.stringify({
      ok: true,
      path: [buildSegment(1, 2)],
      reqId: message.reqId,
      type: 'move_result',
      v: PROTOCOL_VERSION,
      worldRev: 9,
    }),
  });
  return answer.then(function assertAnswer(result): void {
    expect(result.reqId).toBe(message.reqId);
    expect(result.worldRev).toBe(9);
    expect(result.path[0].to).toEqual({ x: 2, y: 2 });
    channel.close();
    fake.restore();
  });
});

/**
 * A server that does not answer a move in time leaves a refusal with a clear
 * reason: the click does not wait forever.
 */
test('a move without an answer is refused', function refusesSilence(): Promise<void> {
  const fake = installFakeSocket();
  const record = buildHandlers();
  const channel = connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    moveTimeoutMs: 10,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  return readRejection(channel.requestMove({ x: 1, y: 2 })).then(function assertRefusal(
    message: string,
  ): void {
    expect(message).toContain('movimento');
    channel.close();
    fake.restore();
  });
});
