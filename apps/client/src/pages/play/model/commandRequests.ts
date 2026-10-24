import type { CommandResult } from '~/pages/play/model/gameProtocol';

/**
 * How long the client waits for the answer to a command.
 *
 * The server applies a command and answers it in the same tick; two seconds is
 * the same budget the answer to a move gets, and a command that takes longer
 * than that is a command whose answer is lost.
 */
export const COMMAND_TIMEOUT_MS = 2000;

export const COMMAND_TIMEOUT_MESSAGE = 'O servidor não respondeu ao comando a tempo.';

export const COMMAND_CLOSED_MESSAGE =
  'A conexão com o servidor foi encerrada antes da resposta do comando.';

/**
 * A command that is waiting for the answer of the server.
 */
type PendingCommand = {
  reject(error: Error): void;
  resolve(result: CommandResult): void;
  timer: ReturnType<typeof setTimeout>;
};

export type CommandRequests = {
  /** Refuses every command that is waiting: the channel is gone. */
  rejectAll(message: string): void;
  /**
   * Sends the command with the request id and waits for the answer that
   * carries it. The send is a callback because the transport belongs to the
   * socket.
   */
  request(reqId: string, send: (reqId: string) => void): Promise<CommandResult>;
  /** Settles the command that the answer belongs to, if it is still waiting. */
  settle(result: CommandResult): void;
};

/**
 * The commands that wait for the answer of the server.
 *
 * The registration lives outside the promise so that the answer can settle it
 * by the request id: the answer is the only proof that the command arrived.
 */
export function createCommandRequests(timeoutMs: number): CommandRequests {
  const pending = new Map<string, PendingCommand>();
  return {
    rejectAll: buildRejectAll(pending),
    request: buildRequest(pending, timeoutMs),
    settle: buildSettle(pending),
  };
}

function buildRequest(
  pending: Map<string, PendingCommand>,
  timeoutMs: number,
): (reqId: string, send: (reqId: string) => void) => Promise<CommandResult> {
  return function request(reqId: string, send: (reqId: string) => void): Promise<CommandResult> {
    return new Promise(function waitForAnswer(
      resolve: (result: CommandResult) => void,
      reject: (error: Error) => void,
    ): void {
      const timer = setTimeout(function onTimeout(): void {
        pending.delete(reqId);
        reject(new Error(COMMAND_TIMEOUT_MESSAGE));
      }, timeoutMs);
      pending.set(reqId, { reject, resolve, timer });
      send(reqId);
    });
  };
}

function buildSettle(pending: Map<string, PendingCommand>): (result: CommandResult) => void {
  return function settle(result: CommandResult): void {
    const waiting = pending.get(result.reqId);
    if (waiting === undefined) {
      return;
    }
    clearTimeout(waiting.timer);
    pending.delete(result.reqId);
    waiting.resolve(result);
  };
}

function buildRejectAll(pending: Map<string, PendingCommand>): (message: string) => void {
  return function rejectAll(message: string): void {
    for (const waiting of pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(new Error(message));
    }
    pending.clear();
  };
}
