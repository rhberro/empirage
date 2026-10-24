import type { GameCommand } from '@creatures/contracts/game';
import type { Tile } from '@creatures/contracts/world';

import { buildChannelMachine } from '~/pages/play/model/gameChannelMachine';
import type { GameChannelDeps } from '~/pages/play/model/gameChannelMachine';
import type { CommandResult, MoveResult } from '~/pages/play/model/gameProtocol';

export type { GameChannelDeps } from '~/pages/play/model/gameChannelMachine';

export type GameChannelController = {
  /** The next close of the server is not expected after all. */
  cancelExpectedClose(): void;
  /** Ends the channel: the screen goes away. */
  close(): void;
  /** The next close of the server is the consequence of a command of the client. */
  expectServerClose(): void;
  /** Opens the channel right away, without waiting for the backoff. */
  reconnectNow(): void;
  /** Sends a command and resolves with the answer of the server. */
  requestCommand(command: GameCommand, reqId?: string): Promise<CommandResult>;
  /** Sends a move and resolves with the answer of the server. */
  requestMove(target: Tile, reqId?: string): Promise<MoveResult>;
};

/**
 * Opens the channel of updates of the game.
 *
 * The channel opens with a ticket, and every attempt asks for a new one: the
 * ticket is of one use, and a ticket that the server refuses is a ticket
 * that cannot be tried again. When the channel falls, the client waits with a
 * backoff and tries again.
 */
export function openGameChannel(deps: GameChannelDeps): GameChannelController {
  const machine = buildChannelMachine(deps);
  machine.attempt();
  return {
    cancelExpectedClose: machine.cancelExpectedClose,
    close: machine.close,
    expectServerClose: machine.expectServerClose,
    reconnectNow: machine.reconnectNow,
    requestCommand: machine.requestCommand,
    requestMove: machine.requestMove,
  };
}
