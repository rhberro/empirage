import type { Logger } from 'pino';

import type { ConnectionRegistry } from '~/ws/connections';

/**
 * The limit of silence of a connection, in milliseconds.
 *
 * The value is the same as the idle timeout of the Bun, and it is larger than
 * the interval of the ping of the client: a connection that is healthy but
 * whose timer was strangled by the browser, in a tab in the background, must
 * not be dropped.
 */
export const LIVENESS_LIMIT_MS = 120 * 1000;

const DEFAULT_INTERVAL_MS = 30 * 1000;
const DEAD_CLOSE_CODE = 1000;
const DEAD_CLOSE_REASON = 'idle timeout';

export type LivenessScanner = {
  /** Stops the sweep. */
  stop(): void;
};

export type LivenessOptions = {
  /** How often the sweep looks at the connections. */
  intervalMs?: number;
  /** How long a connection can stay silent before it is considered dead. */
  limitMs?: number;
  /** The clock of the scanner: the tests move it by hand. */
  now?: () => number;
};

/**
 * The sweep that closes the connections nobody hears from.
 *
 * The Bun already closes a connection that goes idle, but the sweep does not
 * trust that timer: the limit of the server is the one that decides what
 * "idle" means, and the sweep is the guarantee that a dead connection is
 * closed even when the timer of the runtime does not fire.
 */
export function createLivenessScanner(
  connections: ConnectionRegistry,
  logger: Logger,
  options?: LivenessOptions,
): LivenessScanner {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const limitMs = options?.limitMs ?? LIVENESS_LIMIT_MS;
  const now = options?.now ?? Date.now;
  const timer = setInterval(function sweep(): void {
    closeSilentConnections(connections, logger, limitMs, now());
  }, intervalMs);
  timer.unref();

  function stop(): void {
    clearInterval(timer);
  }

  return { stop };
}

/**
 * Closes the connections that went quiet for longer than the limit.
 *
 * The connection is closed with the code of a normal closure, because the
 * client has to reconnect: the socket is dead, not the session.
 */
export function closeSilentConnections(
  connections: ConnectionRegistry,
  logger: Logger,
  limitMs: number,
  now: number,
): void {
  for (const ws of connections.stale(limitMs, now)) {
    logger.info({ userId: ws.data.userId }, 'websocket connection closed as idle');
    connections.close(ws);
    ws.close(DEAD_CLOSE_CODE, DEAD_CLOSE_REASON);
  }
}
