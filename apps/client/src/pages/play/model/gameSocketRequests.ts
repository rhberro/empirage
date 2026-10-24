import type { GameCommand } from '@creatures/contracts/game';
import type { Tile } from '@creatures/contracts/world';

import { COMMAND_CLOSED_MESSAGE } from '~/pages/play/model/commandRequests';
import type { CommandRequests } from '~/pages/play/model/commandRequests';
import type { CommandResult, MoveResult } from '~/pages/play/model/gameProtocol';
import { createRequestId, sendCommand } from '~/pages/play/model/gameSocketConnection';
import { MOVE_CLOSED_MESSAGE } from '~/pages/play/model/moveRequests';
import type { MoveRequests } from '~/pages/play/model/moveRequests';

/**
 * The move and its answer.
 *
 * The promise is settled by the answer that carries the request id, and a
 * server that does not answer in time leaves a rejected promise instead of a
 * click that waits forever.
 */
export function buildRequestMove(
  socket: WebSocket,
  moves: MoveRequests,
): (target: Tile, reqId?: string) => Promise<MoveResult> {
  return function requestMove(target: Tile, reqId?: string): Promise<MoveResult> {
    if (socket.readyState !== globalThis.WebSocket.OPEN) {
      return Promise.reject(new Error(MOVE_CLOSED_MESSAGE));
    }
    const requestId = reqId ?? createRequestId();
    return moves.request(requestId, function sendMove(id: string): void {
      sendCommand(socket, id, { target, type: 'move' });
    });
  };
}

/**
 * The command and its answer.
 *
 * The promise is settled by the answer that carries the request id, and a
 * server that does not answer in time leaves a rejected promise instead of a
 * click that waits forever.
 */
export function buildRequestCommand(
  socket: WebSocket,
  commands: CommandRequests,
): (command: GameCommand, reqId?: string) => Promise<CommandResult> {
  return function requestCommand(command: GameCommand, reqId?: string): Promise<CommandResult> {
    if (socket.readyState !== globalThis.WebSocket.OPEN) {
      return Promise.reject(new Error(COMMAND_CLOSED_MESSAGE));
    }
    const requestId = reqId ?? createRequestId();
    return commands.request(requestId, function send(id: string): void {
      sendCommand(socket, id, command);
    });
  };
}
