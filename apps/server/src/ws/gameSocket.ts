import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ClientMessage, GameCommand, GameErrorCode } from '@creatures/contracts/game';
import type { Trainer } from '@creatures/contracts/trainer';
import type { ServerWebSocket, WebSocketHandler } from 'bun';

import { findTrainerById } from '~/db/trainerRepository';
import type { ServerDependencies } from '~/dependencies';
import { isUuid } from '~/validation/trainer';
import type { ConnectionRegistry, SocketData } from '~/ws/connections';
import { buildCommandResult, buildErrorMessage, sendMessage } from '~/ws/protocol';

const MAX_REQUEST_ID_LENGTH = 128;
const MAX_SLOT = 6;

export function createGameSocketHandler(
  deps: ServerDependencies,
  connections: ConnectionRegistry,
): WebSocketHandler<SocketData> {
  function open(ws: ServerWebSocket<SocketData>): void {
    connections.open(ws);
  }

  function close(ws: ServerWebSocket<SocketData>): void {
    connections.close(ws);
  }

  function message(ws: ServerWebSocket<SocketData>, raw: string | Buffer): void {
    connections.touch(ws);
    handleMessage(deps, ws, raw).catch(reportFailure(deps, ws));
  }

  /**
   * The pong of the protocol is a sign of life too.
   *
   * The ping of the runtime is answered by the browser without the code of
   * the client running, so this is the only sign of life a quiet connection
   * gives.
   */
  function pong(ws: ServerWebSocket<SocketData>): void {
    connections.touch(ws);
  }

  return { close, message, open, pong };
}

function handleMessage(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
  raw: string | Buffer,
): Promise<void> {
  const parsed = parseClientMessage(raw);
  if (parsed === null) {
    sendError(ws, 'invalid_message', 'Mensagem inválida.');
    return Promise.resolve();
  }
  if (parsed.type === 'ping') {
    sendMessage(ws, { sentAt: parsed.sentAt, type: 'pong', v: PROTOCOL_VERSION });
    return Promise.resolve();
  }
  if (parsed.type === 'command') {
    sendCommandRefusal(deps, ws, parsed.reqId);
    return Promise.resolve();
  }
  return handleSelectTrainer(deps, ws, parsed.reqId, parsed.trainerId);
}

/**
 * Opens the session of the trainer and delivers the state.
 *
 * The snapshot goes through the broadcaster, the same path the HTTP commands
 * use: the state is loaded from the database and sent to the channel of the
 * account.
 *
 * The answer of the command comes before the snapshot: the client learns the
 * revision it is waiting for, and the snapshot that carries it follows.
 */
function handleSelectTrainer(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
  reqId: string,
  trainerId: string,
): Promise<void> {
  const userId = ws.data.userId;
  return findTrainerById(deps.admin, trainerId, userId).then(function checkOwner(
    trainer: Trainer | null,
  ): void {
    if (trainer === null) {
      sendCommandFailure(ws, reqId, deps.revs.current(userId), 'trainer_not_found');
      return;
    }
    deps.sessions.set(userId, trainer.id);
    const rev = deps.broadcaster.pushState(userId, trainer.id);
    sendMessage(ws, buildCommandResult(reqId, true, rev));
  });
}

/**
 * The commands of the hunt are not executed yet.
 *
 * The answer keeps the request id, so the client does not wait for an answer
 * that never comes, and the connection stays open.
 */
function sendCommandRefusal(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
  reqId: string,
): void {
  const rev = deps.revs.current(ws.data.userId);
  sendCommandFailure(ws, reqId, rev, 'invalid_command');
}

/**
 * The answer of a command that did not work.
 *
 * The reason travels in the answer of the command, and not in an error
 * message: the error of the channel has no request id, so the client could
 * not tell which request failed.
 */
function sendCommandFailure(
  ws: ServerWebSocket<SocketData>,
  reqId: string,
  rev: number,
  code: GameErrorCode,
): void {
  sendMessage(ws, buildCommandResult(reqId, false, rev, code));
}

/**
 * Reads a message of the client.
 *
 * The version of the protocol and the request id are checked here: a message
 * of another version is refused with clarity, and a message that expects an
 * answer without a request id cannot be answered.
 */
export function parseClientMessage(raw: string | Buffer): ClientMessage | null {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const candidate = parsed as {
    command?: unknown;
    reqId?: unknown;
    sentAt?: unknown;
    trainerId?: unknown;
    type?: unknown;
    v?: unknown;
  };
  if (candidate.v !== PROTOCOL_VERSION) {
    return null;
  }
  if (candidate.type === 'ping' && typeof candidate.sentAt === 'number') {
    return { sentAt: candidate.sentAt, type: 'ping', v: PROTOCOL_VERSION };
  }
  if (candidate.type === 'select_trainer' && typeof candidate.trainerId === 'string') {
    const reqId = readRequestId(candidate.reqId);
    if (reqId === null || !isUuid(candidate.trainerId)) {
      return null;
    }
    return { reqId, trainerId: candidate.trainerId, type: 'select_trainer', v: PROTOCOL_VERSION };
  }
  if (candidate.type === 'command') {
    const reqId = readRequestId(candidate.reqId);
    const command = readCommand(candidate.command);
    if (reqId === null || command === null) {
      return null;
    }
    return { command, reqId, type: 'command', v: PROTOCOL_VERSION };
  }
  return null;
}

function readRequestId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (value === '' || value.length > MAX_REQUEST_ID_LENGTH) {
    return null;
  }
  return value;
}

/**
 * Reads the command of the hunt.
 *
 * The command is only read, never applied: the hunt is not in the game yet,
 * and a command that is not understood is refused instead of guessed.
 */
function readCommand(value: unknown): GameCommand | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { creatureId?: unknown; slot?: unknown; type?: unknown };
  if (candidate.type === 'finalize_hunt') {
    return { type: 'finalize_hunt' };
  }
  if (candidate.type === 'swap_creature' && typeof candidate.creatureId === 'string') {
    if (!isUuid(candidate.creatureId)) {
      return null;
    }
    return { creatureId: candidate.creatureId, type: 'swap_creature' };
  }
  if (candidate.type === 'use_ability' || candidate.type === 'use_consumable') {
    const slot = readSlot(candidate.slot);
    if (slot === null) {
      return null;
    }
    return { slot, type: candidate.type };
  }
  return null;
}

function readSlot(value: unknown): 0 | 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  if (value < 0 || value > MAX_SLOT) {
    return null;
  }
  return value as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function sendError(ws: ServerWebSocket<SocketData>, code: GameErrorCode, message: string): void {
  sendMessage(ws, buildErrorMessage(code, message));
}

function reportFailure(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
): (error: unknown) => void {
  return function report(error: unknown): void {
    deps.logger.error({ err: error, userId: ws.data.userId }, 'websocket message failure');
    sendError(ws, 'internal_error', 'Erro interno do servidor.');
  };
}
