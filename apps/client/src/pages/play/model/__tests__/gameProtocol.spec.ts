import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';

import { parseServerMessage } from '~/pages/play/model/gameProtocol';

/**
 * A message of another version is refused with clarity: the client does not
 * read a message of a protocol it does not know.
 */
test('a message of another version is refused', function refusesVersion(): void {
  const parsed = parseServerMessage(JSON.stringify({ sentAt: 1, type: 'pong', v: 99 }));
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    return;
  }
  expect(parsed.failure).toBe('unsupported_version');
});

/**
 * A message that does not make sense is refused, and the connection stays
 * open: one broken message does not kill the channel.
 */
test('a message that does not make sense is refused', function refusesBroken(): void {
  const parsed = parseServerMessage('{ not json');
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    return;
  }
  expect(parsed.failure).toBe('malformed');
});

/**
 * The answer of the server to a command carries the request it belongs to and
 * the rule that refused it.
 */
test('the answer of a command is read', function readsCommandResult(): void {
  const parsed = parseServerMessage(
    JSON.stringify({
      code: 'invalid_command',
      ok: false,
      reqId: 'req-1',
      rev: 7,
      type: 'command_result',
      v: PROTOCOL_VERSION,
    }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    return;
  }
  expect(parsed.message.kind).toBe('command_result');
  if (parsed.message.kind !== 'command_result') {
    return;
  }
  expect(parsed.message.result.reqId).toBe('req-1');
  expect(parsed.message.result.rev).toBe(7);
  expect(parsed.message.result.code).toBe('invalid_command');
});

/**
 * The pong is read: it is the proof that the server is alive.
 */
test('the pong is read', function readsPong(): void {
  const parsed = parseServerMessage(
    JSON.stringify({ sentAt: 123, type: 'pong', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    return;
  }
  expect(parsed.message.kind).toBe('pong');
});
