import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { GameErrorCode } from '@creatures/contracts/game';
import type { PlayerState } from '@creatures/contracts/player';

import { readHuntPayload } from '~/pages/play/model/gameHuntProtocol';
import type { HuntPayload } from '~/pages/play/model/gameHuntProtocol';
import { readGameErrorCode, readWorldPayload } from '~/pages/play/model/gameWorldProtocol';
import type { WorldPayload } from '~/pages/play/model/gameWorldProtocol';

export type { HuntPayload } from '~/pages/play/model/gameHuntProtocol';
export type {
  ActorLeaveMessage,
  ActorUpdateMessage,
  MoveResult,
  WorldStateMessage,
} from '~/pages/play/model/gameWorldProtocol';

/**
 * Why a message of the server was refused.
 */
export type ProtocolFailure = 'malformed' | 'unsupported_version';

/**
 * The answer of the server to a command.
 */
export type CommandResult = {
  /** The rule that broke, when the command was refused. */
  code: GameErrorCode | null;
  /** Whether the server accepted the command. */
  ok: boolean;
  /** The request the answer belongs to. */
  reqId: string;
  /** The revision of the state after the command. */
  rev: number;
};

/**
 * What the client reads out of a message of the server.
 */
export type ServerPayload =
  | WorldPayload
  | HuntPayload
  | { kind: 'command_result'; result: CommandResult }
  | { kind: 'error'; code: GameErrorCode | null; message: string }
  | { kind: 'pong'; sentAt: number; serverNow: number }
  | { kind: 'state_snapshot'; state: PlayerState };

export type ParsedServerMessage =
  | { message: ServerPayload; ok: true }
  | { failure: ProtocolFailure; ok: false };

/**
 * The parser of the messages of the server.
 *
 * The version of the protocol is the first thing that is read: a message of
 * another version is refused with clarity, instead of being read as if it
 * were of this one. A message that does not make sense is refused too, and
 * the connection stays open: one broken message does not kill the channel.
 */
export function parseServerMessage(data: unknown): ParsedServerMessage {
  if (typeof data !== 'string') {
    return { failure: 'malformed', ok: false };
  }
  const parsed = parseJson(data);
  if (parsed === null || typeof parsed !== 'object' || parsed === null) {
    return { failure: 'malformed', ok: false };
  }
  const version = readVersion(parsed);
  if (version === null) {
    return { failure: 'malformed', ok: false };
  }
  if (version !== PROTOCOL_VERSION) {
    return { failure: 'unsupported_version', ok: false };
  }
  const payload = readPayload(parsed);
  if (payload === null) {
    return { failure: 'malformed', ok: false };
  }
  return { message: payload, ok: true };
}

/**
 * The message of a refusal, said to the player.
 */
export function readProtocolFailureMessage(failure: ProtocolFailure): string {
  if (failure === 'unsupported_version') {
    return 'O servidor fala outra versão do protocolo. Atualize a página para jogar.';
  }
  return 'O servidor enviou uma mensagem que não foi entendida.';
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function readVersion(value: object): number | null {
  const envelope = value as { v?: unknown };
  return typeof envelope.v === 'number' ? envelope.v : null;
}

function readPayload(value: object): ServerPayload | null {
  const message = value as { type?: unknown };
  if (message.type === 'state_snapshot') {
    return readStateSnapshot(value);
  }
  if (message.type === 'pong') {
    return readPong(value);
  }
  if (message.type === 'error') {
    return readError(value);
  }
  if (message.type === 'command_result') {
    return readCommandResult(value);
  }
  const hunt = readHuntPayload(message.type, value);
  if (hunt !== null) {
    return hunt;
  }
  return readWorldPayload(message.type, value);
}

function readStateSnapshot(value: object): ServerPayload | null {
  const message = value as { state?: unknown };
  if (!isPlayerState(message.state)) {
    return null;
  }
  return { kind: 'state_snapshot', state: message.state };
}

function readPong(value: object): ServerPayload | null {
  const message = value as { sentAt?: unknown; serverNow?: unknown };
  if (typeof message.sentAt !== 'number' || typeof message.serverNow !== 'number') {
    return null;
  }
  return { kind: 'pong', sentAt: message.sentAt, serverNow: message.serverNow };
}

function readError(value: object): ServerPayload | null {
  const message = value as { code?: unknown; message?: unknown };
  if (typeof message.message !== 'string') {
    return null;
  }
  return {
    code: readGameErrorCode(message.code),
    kind: 'error',
    message: message.message,
  };
}

function readCommandResult(value: object): ServerPayload | null {
  const message = value as { code?: unknown; ok?: unknown; reqId?: unknown; rev?: unknown };
  if (typeof message.ok !== 'boolean' || typeof message.reqId !== 'string') {
    return null;
  }
  if (typeof message.rev !== 'number') {
    return null;
  }
  return {
    kind: 'command_result',
    result: {
      code: readGameErrorCode(message.code),
      ok: message.ok,
      reqId: message.reqId,
      rev: message.rev,
    },
  };
}

function isPlayerState(value: unknown): value is PlayerState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const state = value as Partial<PlayerState>;
  return typeof state.trainer === 'object' && state.trainer !== null && Array.isArray(state.team);
}
