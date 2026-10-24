import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';

import { connectGameSocket } from '~/pages/play/model/gameSocket';

import {
  BASE_URL,
  buildHandlers,
  installFakeSocket,
  readRejection,
  TICKET,
} from './gameSocketFixture';

test('a command is answered by request id', function answersCommand(): Promise<void> {
  const fake = installFakeSocket();
  const record = buildHandlers();
  const channel = connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  const answer = channel.requestCommand({ type: 'finalize_hunt' });
  const message = JSON.parse(fake.sockets[0].sent[1]);
  expect(message.type).toBe('command');
  expect(message.command).toEqual({ type: 'finalize_hunt' });
  expect(message.v).toBe(PROTOCOL_VERSION);
  fake.sockets[0].emit('message', {
    data: JSON.stringify({
      ok: true,
      reqId: message.reqId,
      rev: 9,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    }),
  });
  return answer.then(function assertAnswer(result): void {
    expect(result.ok).toBe(true);
    expect(result.rev).toBe(9);
    expect(result.reqId).toBe(message.reqId);
    channel.close();
    fake.restore();
  });
});

test('the selection of the trainer keeps its own answer', function answersSelectTrainer(): void {
  const fake = installFakeSocket();
  const record = buildHandlers();
  const channel = connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  const select = JSON.parse(fake.sockets[0].sent[0]);
  expect(select.type).toBe('select_trainer');
  fake.sockets[0].emit('message', {
    data: JSON.stringify({
      code: 'invalid_command',
      ok: false,
      reqId: select.reqId,
      rev: 1,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    }),
  });
  expect(record.results).toHaveLength(1);
  expect(record.results[0].reqId).toBe(select.reqId);
  channel.close();
  fake.restore();
});

test('a command without an answer is refused', function refusesSilence(): Promise<void> {
  const fake = installFakeSocket();
  const record = buildHandlers();
  const channel = connectGameSocket({
    baseUrl: BASE_URL,
    commandTimeoutMs: 10,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  return readRejection(channel.requestCommand({ type: 'finalize_hunt' })).then(
    function assertRefusal(message: string): void {
      expect(message).toContain('comando');
      channel.close();
      fake.restore();
    },
  );
});

test('the commands waiting are refused when the channel closes', function refusesOnClose(): Promise<void> {
  const fake = installFakeSocket();
  const record = buildHandlers();
  const channel = connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  const rejection = readRejection(channel.requestCommand({ type: 'finalize_hunt' }));
  channel.close();
  return rejection.then(function assertRefusal(message: string): void {
    expect(message).toContain('conexão');
    fake.restore();
  });
});
