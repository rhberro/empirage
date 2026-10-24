import type { MoveResult } from '~/pages/play/model/gameWorldProtocol';

/**
 * How long the client waits for the answer to a move.
 *
 * The server plans and answers a move in the same tick; two seconds is the
 * same budget the state after a command gets, and a move that takes longer
 * than that is a move whose answer is lost.
 */
export const MOVE_TIMEOUT_MS = 2000;

export const MOVE_TIMEOUT_MESSAGE = 'O servidor não respondeu ao movimento a tempo.';

export const MOVE_CLOSED_MESSAGE =
  'A conexão com o servidor foi encerrada antes da resposta do movimento.';

/**
 * A move that is waiting for the answer of the server.
 */
type PendingMove = {
  reject(error: Error): void;
  resolve(result: MoveResult): void;
  timer: ReturnType<typeof setTimeout>;
};

export type MoveRequests = {
  /** Refuses every move that is waiting: the channel is gone. */
  rejectAll(message: string): void;
  /**
   * Sends the move with the request id and waits for the answer that carries
   * it. The send is a callback because the transport belongs to the socket.
   */
  request(reqId: string, send: (reqId: string) => void): Promise<MoveResult>;
  /** Settles the move that the answer belongs to, if it is still waiting. */
  settle(result: MoveResult): void;
};

/**
 * The moves that wait for the answer of the server.
 *
 * The registration lives outside the promise so that the answer can settle it
 * by the request id: the answer is the only proof that the move arrived.
 */
export function createMoveRequests(timeoutMs: number): MoveRequests {
  const pending = new Map<string, PendingMove>();
  return {
    rejectAll: buildRejectAll(pending),
    request: buildRequest(pending, timeoutMs),
    settle: buildSettle(pending),
  };
}

function buildRequest(
  pending: Map<string, PendingMove>,
  timeoutMs: number,
): (reqId: string, send: (reqId: string) => void) => Promise<MoveResult> {
  return function request(reqId: string, send: (reqId: string) => void): Promise<MoveResult> {
    return new Promise(function waitForAnswer(
      resolve: (result: MoveResult) => void,
      reject: (error: Error) => void,
    ): void {
      const timer = setTimeout(function onTimeout(): void {
        pending.delete(reqId);
        reject(new Error(MOVE_TIMEOUT_MESSAGE));
      }, timeoutMs);
      pending.set(reqId, { reject, resolve, timer });
      send(reqId);
    });
  };
}

function buildSettle(pending: Map<string, PendingMove>): (result: MoveResult) => void {
  return function settle(result: MoveResult): void {
    const waiting = pending.get(result.reqId);
    if (waiting === undefined) {
      return;
    }
    clearTimeout(waiting.timer);
    pending.delete(result.reqId);
    waiting.resolve(result);
  };
}

function buildRejectAll(pending: Map<string, PendingMove>): (message: string) => void {
  return function rejectAll(message: string): void {
    for (const waiting of pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(new Error(message));
    }
    pending.clear();
  };
}
