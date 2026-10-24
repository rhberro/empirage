import type { GameCommand } from '@creatures/contracts/game';
import type { Tile } from '@creatures/contracts/world';

import type { CommandResult, MoveResult } from '~/pages/play/model/gameProtocol';
import type { GameSocket } from '~/pages/play/model/gameSocket';

export type SocketRecorder = {
  commands: { command: GameCommand; reqId: string | undefined }[];
  moves: { reqId: string | undefined; target: Tile }[];
};

function noop(): void {
  void 0;
}

export function buildFakeGameSocket(recorder: SocketRecorder): GameSocket {
  return {
    close: noop,
    requestCommand: function requestCommand(
      command: GameCommand,
      reqId?: string,
    ): Promise<CommandResult> {
      recorder.commands.push({ command, reqId });
      return Promise.resolve({
        code: null,
        ok: true,
        reqId: reqId ?? 'req-command',
        rev: 1,
      });
    },
    requestMove: function requestMove(target: Tile, reqId?: string): Promise<MoveResult> {
      recorder.moves.push({ reqId, target });
      return Promise.resolve({
        code: null,
        ok: true,
        path: [],
        reqId: reqId ?? 'req-move',
        worldRev: 1,
      });
    },
  };
}
