import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ActorMedia, PathSegment } from '@creatures/contracts/world';

import { parseServerMessage } from '~/pages/play/model/gameProtocol';

function buildActor(actorId: string, x: number, y: number): ActorMedia {
  return { actorId, dir: 'down', gender: 'female', name: actorId, position: { x, y } };
}

function buildSegment(): PathSegment {
  return { dir: 'right', endsAt: 400, from: { x: 1, y: 1 }, startsAt: 100, to: { x: 2, y: 1 } };
}

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
 * The pong is read: it is the proof that the server is alive, and it carries
 * the server clock that places every actor in time.
 */
test('the pong is read', function readsPong(): void {
  const parsed = parseServerMessage(
    JSON.stringify({ sentAt: 123, serverNow: 456, type: 'pong', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    return;
  }
  expect(parsed.message).toEqual({ kind: 'pong', sentAt: 123, serverNow: 456 });
});

/**
 * The world state carries the actor of the connection and the actors around
 * it, with the walk of each one when there is one.
 */
test('the world state is read', function readsWorldState(): void {
  const segment = buildSegment();
  const you = buildActor('you', 1, 1);
  const parsed = parseServerMessage(
    JSON.stringify({
      actors: [{ ...buildActor('other', 4, 5), segment }, buildActor('third', 6, 7)],
      type: 'world_state',
      v: PROTOCOL_VERSION,
      worldRev: 12,
      you,
    }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'world_state') {
    return;
  }
  expect(parsed.message.world.worldRev).toBe(12);
  expect(parsed.message.world.you.actorId).toBe('you');
  expect(parsed.message.world.actors.length).toBe(2);
  expect(parsed.message.world.actors[0].segment).toEqual(segment);
});

/**
 * The answer of a move carries the request, the walk that was planned and the
 * revision the walk produced.
 */
test('the move result is read', function readsMoveResult(): void {
  const path = [buildSegment(), { ...buildSegment(), from: { x: 2, y: 1 }, to: { x: 3, y: 1 } }];
  const parsed = parseServerMessage(
    JSON.stringify({
      code: 'tile_blocked',
      ok: false,
      path,
      reqId: 'req-7',
      type: 'move_result',
      v: PROTOCOL_VERSION,
      worldRev: 13,
    }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'move_result') {
    return;
  }
  expect(parsed.message.result.reqId).toBe('req-7');
  expect(parsed.message.result.code).toBe('tile_blocked');
  expect(parsed.message.result.worldRev).toBe(13);
  expect(parsed.message.result.path.length).toBe(2);
});

/**
 * The update of an actor and the leave of another are read by the same rule:
 * the actor (or its id) and the revision that orders the world.
 */
test('the actor update and leave are read', function readsActorMessages(): void {
  const update = parseServerMessage(
    JSON.stringify({
      actor: buildActor('other', 4, 5),
      type: 'actor_update',
      v: PROTOCOL_VERSION,
      worldRev: 14,
    }),
  );
  const leave = parseServerMessage(
    JSON.stringify({ actorId: 'other', type: 'actor_leave', v: PROTOCOL_VERSION, worldRev: 15 }),
  );
  expect(update.ok).toBe(true);
  expect(leave.ok).toBe(true);
  if (!update.ok || update.message.kind !== 'actor_update') {
    return;
  }
  if (!leave.ok || leave.message.kind !== 'actor_leave') {
    return;
  }
  expect(update.message.update.actor.actorId).toBe('other');
  expect(update.message.update.worldRev).toBe(14);
  expect(leave.message.leave.actorId).toBe('other');
  expect(leave.message.leave.worldRev).toBe(15);
});

/**
 * A world message with an actor that does not make sense is refused, and the
 * channel stays open: one broken message does not kill the game.
 */
test('a broken world message is refused', function refusesBrokenWorld(): void {
  const parsed = parseServerMessage(
    JSON.stringify({
      actors: [{ ...buildActor('other', 4, 5), dir: 'sideways' }],
      type: 'world_state',
      v: PROTOCOL_VERSION,
      worldRev: 1,
      you: buildActor('you', 1, 1),
    }),
  );
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    return;
  }
  expect(parsed.failure).toBe('malformed');
});
