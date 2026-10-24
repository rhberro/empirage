import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ClientMessage, GameCommand } from '@creatures/contracts/game';

/**
 * How often the client asks the server for its clock and says that it is alive.
 *
 * The answer carries the server time, so the same message is the sample of the
 * clock and the proof of life. Two seconds gives the clock enough samples to
 * survive a burst of jitter without flooding the channel. A background tab has
 * its timers throttled; when it comes back, the absolute timestamps put every
 * actor in the right place and the next pong corrects the buffer.
 */
const PING_INTERVAL_MS = 2_000;

/**
 * How long the client accepts the silence of the server.
 *
 * The connection is not dead because the client stopped talking: it is dead
 * when the server stops talking. A hundred seconds is longer than the idle
 * timeout of the server, so a server that is alive is one that answers.
 */
const LIVENESS_TIMEOUT_MS = 100_000;

const WS_PATH = '/ws';

export const LIVENESS_MESSAGE = 'A conexão com o servidor parou de responder.';

/**
 * What the connection keeps alive while it is open.
 */
export type ConnectionSession = {
  /** Whether the server stopped answering. */
  deadBySilence: boolean;
  /** How long the client accepts the silence of the server. */
  livenessTimeoutMs: number;
  /** How often the client says that it is alive. */
  pingIntervalMs: number;
  /** The timer of the ping. */
  pingTimer: ReturnType<typeof setInterval> | null;
  /** The timer of the watchdog of the silence. */
  watchdogTimer: ReturnType<typeof setTimeout> | null;
};

export type ConnectionOptions = {
  baseUrl: string;
  /** How long the client accepts the silence of the server. */
  livenessTimeoutMs?: number;
  /** How often the client says that it is alive. */
  pingIntervalMs?: number;
  ticket: string;
};

export function createConnectionSession(options: ConnectionOptions): ConnectionSession {
  return {
    deadBySilence: false,
    livenessTimeoutMs: options.livenessTimeoutMs ?? LIVENESS_TIMEOUT_MS,
    pingIntervalMs: options.pingIntervalMs ?? PING_INTERVAL_MS,
    pingTimer: null,
    watchdogTimer: null,
  };
}

export function startPing(socket: WebSocket, session: ConnectionSession): void {
  stopPing(session);
  session.pingTimer = setInterval(function sendPing(): void {
    sendMessage(socket, { sentAt: Date.now(), type: 'ping', v: PROTOCOL_VERSION });
  }, session.pingIntervalMs);
}

/**
 * The watchdog of the silence.
 *
 * The client does not trust its own pings: a tab in the background has its
 * timers throttled, and the only proof that the connection lives is the voice
 * of the server.
 */
export function startWatchdog(
  socket: WebSocket,
  session: ConnectionSession,
  onSilence: () => void,
): void {
  stopWatchdog(session);
  session.watchdogTimer = setTimeout(function onDeadSilence(): void {
    onSilence();
    socket.close();
  }, session.livenessTimeoutMs);
}

export function stopTimers(session: ConnectionSession): void {
  stopPing(session);
  stopWatchdog(session);
}

export function buildSocketUrl(baseUrl: string, ticket: string): string {
  const url = new globalThis.URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = WS_PATH;
  url.search = `ticket=${encodeURIComponent(ticket)}`;
  return url.toString();
}

let requestCounter = 0;

export function createRequestId(): string {
  requestCounter += 1;
  return `game-request-${requestCounter}`;
}

export function sendMessage(socket: WebSocket, message: ClientMessage): void {
  if (socket.readyState !== globalThis.WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(message));
}

/**
 * Sends a command and returns the request that correlates the answer.
 *
 * Every command of the game goes out the same way: the id is the one the
 * server answers with, and the answer is the proof that the command arrived.
 */
export function sendCommand(socket: WebSocket, reqId: string, command: GameCommand): void {
  sendMessage(socket, { command, reqId, type: 'command', v: PROTOCOL_VERSION });
}

function stopPing(session: ConnectionSession): void {
  if (session.pingTimer === null) {
    return;
  }
  clearInterval(session.pingTimer);
  session.pingTimer = null;
}

function stopWatchdog(session: ConnectionSession): void {
  if (session.watchdogTimer === null) {
    return;
  }
  clearTimeout(session.watchdogTimer);
  session.watchdogTimer = null;
}
