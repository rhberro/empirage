import type { GameCommand } from '@creatures/contracts/game';
import type { ServerWebSocket } from 'bun';

import type { ServerDependencies } from '~/dependencies';
import type { SocketData } from '~/ws/connections';
import { buildCommandResult, sendMessage } from '~/ws/protocol';

/**
 * The commands of the hunt.
 *
 * The player never uses an ability or a consumable by hand: the rotation and
 * the consumables belong to the simulation. The finalization and the swap are
 * the only decisions of the player, and both answer with the request id.
 */
export function handleHuntCommand(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
  reqId: string,
  command: GameCommand,
): Promise<void> {
  if (command.type === 'finalize_hunt') {
    return finalizeHunt(deps, ws, reqId);
  }
  if (command.type === 'swap_creature') {
    return swapCreature(deps, ws, reqId, command.creatureId);
  }
  sendCommandFailure(deps, ws, reqId, 'invalid_command');
  return Promise.resolve();
}

function finalizeHunt(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
  reqId: string,
): Promise<void> {
  const userId = ws.data.userId;
  const trainerId = deps.sessions.get(userId);
  if (trainerId === null) {
    sendCommandFailure(deps, ws, reqId, 'invalid_command');
    return Promise.resolve();
  }
  return deps.hunts.finalize(trainerId).then(
    function finalized(): void {
      sendMessage(ws, buildCommandResult(reqId, true, deps.revs.current(userId)));
    },
    function failed(error: unknown): void {
      deps.logger.error({ err: error, trainerId, userId }, 'hunt finalization failed');
      sendCommandFailure(deps, ws, reqId, 'internal_error');
    },
  );
}

function swapCreature(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
  reqId: string,
  creatureId: string,
): Promise<void> {
  const userId = ws.data.userId;
  const trainerId = deps.sessions.get(userId);
  if (trainerId === null) {
    sendCommandFailure(deps, ws, reqId, 'invalid_command');
    return Promise.resolve();
  }
  return deps.hunts.swap(trainerId, creatureId).then(function swapped(ok: boolean): void {
    if (!ok) {
      sendCommandFailure(deps, ws, reqId, 'invalid_command');
      return;
    }
    sendMessage(ws, buildCommandResult(reqId, true, deps.revs.current(userId)));
  });
}

/**
 * The answer of a command that did not work: the code travels in the answer,
 * with the request id, so the client knows which request failed.
 */
function sendCommandFailure(
  deps: ServerDependencies,
  ws: ServerWebSocket<SocketData>,
  reqId: string,
  code: 'invalid_command' | 'internal_error',
): void {
  sendMessage(ws, buildCommandResult(reqId, false, deps.revs.current(ws.data.userId), code));
}
