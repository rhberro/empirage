import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { GameErrorCode, ServerMessage } from '@creatures/contracts/game';
import type { PlayerState } from '@creatures/contracts/player';
import type { ServerWebSocket } from 'bun';

import type { SocketData } from '~/ws/connections';

/**
 * The state of the player, as the client sees it.
 */
export function buildStateSnapshot(state: PlayerState): ServerMessage {
  return { state, type: 'state_snapshot', v: PROTOCOL_VERSION };
}

export function buildErrorMessage(code: GameErrorCode, message: string): ServerMessage {
  return { code, message, type: 'error', v: PROTOCOL_VERSION };
}

/**
 * The answer of a command, with the revision it produced.
 *
 * The revision is the one of the state the command produced, so the client
 * knows which snapshot to wait for without asking for the state again.
 *
 * The code says why the command did not work, and it travels with the request
 * id: the client knows which request failed and why, with a single message.
 */
export function buildCommandResult(
  reqId: string,
  ok: boolean,
  rev: number,
  code?: GameErrorCode,
): ServerMessage {
  return { code, ok, reqId, rev, type: 'command_result', v: PROTOCOL_VERSION };
}

/**
 * Sends the message to the client.
 *
 * The version is written on the way out whatever the builder did, so a
 * message never leaves the server without it.
 */
export function sendMessage(ws: ServerWebSocket<SocketData>, message: ServerMessage): void {
  ws.send(JSON.stringify({ ...message, v: PROTOCOL_VERSION }));
}
