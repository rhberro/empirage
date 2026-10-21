import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ClientMessage } from '@creatures/contracts/game';
import type { PlayerState } from '@creatures/contracts/player';

import { parseServerMessage, readProtocolFailureMessage } from '~/pages/play/model/gameProtocol';
import type { CommandResult, ServerPayload } from '~/pages/play/model/gameProtocol';

/**
 * How often the client says that it is alive.
 *
 * The interval is longer than the throttle of the timers of a background tab
 * (about one tick per minute): a ping that the browser delays is a ping that
 * arrives late, and a late ping only adds noise. The idle timeout of the
 * server (120 s) was dimensioned with this interval in mind.
 */
const PING_INTERVAL_MS = 45_000;

/**
 * How long the client accepts the silence of the server.
 *
 * The connection is not dead because the client stopped talking: it is dead
 * when the server stops talking. A hundred seconds is longer than the idle
 * timeout of the server, so a server that is alive is one that answers.
 */
const LIVENESS_TIMEOUT_MS = 100_000;

const WS_PATH = '/ws';

const LIVENESS_MESSAGE = 'A conexão com o servidor parou de responder.';

/**
 * The close of a connection that died without the server saying why.
 */
const ABNORMAL_CLOSE_CODE = 1006;

export type GameSocketStatus = 'closed' | 'connecting' | 'open';

export type GameSocketHandlers = {
  /** The channel is closed, with the code that says why. */
  onClose(code: number): void;
  /** The server answered a command of the client. */
  onCommandResult(result: CommandResult): void;
  /** Something happened that the player has to know about. */
  onError(message: string): void;
  /** The server pushed the state of the player. */
  onState(state: PlayerState): void;
  /** The state of the channel changed. */
  onStatus(status: GameSocketStatus): void;
};

export type GameSocket = {
  close(): void;
};

export type GameSocketOptions = {
  baseUrl: string;
  handlers: GameSocketHandlers;
  /** How often the client says that it is alive. */
  pingIntervalMs?: number;
  /** How long the client accepts the silence of the server. */
  livenessTimeoutMs?: number;
  /** The ticket that opens the channel: the token of the account does not travel in the address. */
  ticket: string;
  trainerId: string;
};

/**
 * What the client keeps while the channel is open.
 */
type SocketSession = {
  /** Whether the server stopped answering. */
  deadBySilence: boolean;
  /** How long the client accepts the silence of the server. */
  livenessTimeoutMs: number;
  /** How often the client says that it is alive. */
  pingIntervalMs: number;
  /** The timer of the ping. */
  pingTimer: ReturnType<typeof setInterval> | null;
  /** The request of the selection of the trainer. */
  selectReqId: string;
  /** The timer of the watchdog of the silence. */
  watchdogTimer: ReturnType<typeof setTimeout> | null;
};

let requestCounter = 0;

/**
 * The channel of updates of the game.
 *
 * The channel carries the state that the server pushes and the answers to the
 * commands that the client sends. The ticket is of one use: the client asks
 * for a new one every time it opens the channel.
 */
export function connectGameSocket(options: GameSocketOptions): GameSocket {
  const { baseUrl, handlers, ticket, trainerId } = options;
  const socket = new globalThis.WebSocket(buildSocketUrl(baseUrl, ticket));
  const session: SocketSession = {
    deadBySilence: false,
    livenessTimeoutMs: options.livenessTimeoutMs ?? LIVENESS_TIMEOUT_MS,
    pingIntervalMs: options.pingIntervalMs ?? PING_INTERVAL_MS,
    pingTimer: null,
    selectReqId: createRequestId(),
    watchdogTimer: null,
  };

  handlers.onStatus('connecting');

  socket.addEventListener('open', buildOpenHandler(socket, session, handlers, trainerId));
  socket.addEventListener('message', buildMessageHandler(socket, session, handlers));
  socket.addEventListener('error', buildErrorHandler(handlers));
  socket.addEventListener('close', buildCloseHandler(session, handlers));

  return {
    close: function close(): void {
      stopTimers(session);
      socket.close();
    },
  };
}

/**
 * The channel opened: the client says which trainer it is and starts to
 * watch the silence of the server.
 */
function buildOpenHandler(
  socket: WebSocket,
  session: SocketSession,
  handlers: GameSocketHandlers,
  trainerId: string,
): () => void {
  return function handleOpen(): void {
    startPing(socket, session);
    startWatchdog(socket, session, handlers);
    sendMessage(socket, {
      reqId: session.selectReqId,
      trainerId,
      type: 'select_trainer',
      v: PROTOCOL_VERSION,
    });
    handlers.onStatus('open');
  };
}

/**
 * A message of the server.
 *
 * Every message that arrives restarts the count of the silence: the pong
 * included, because it is the proof that the server is there.
 */
function buildMessageHandler(
  socket: WebSocket,
  session: SocketSession,
  handlers: GameSocketHandlers,
): (event: MessageEvent) => void {
  return function handleMessage(event: MessageEvent): void {
    startWatchdog(socket, session, handlers);
    const parsed = parseServerMessage(event.data);
    if (!parsed.ok) {
      handlers.onError(readProtocolFailureMessage(parsed.failure));
      return;
    }
    readPayload(parsed.message, session, handlers);
  };
}

function buildErrorHandler(handlers: GameSocketHandlers): () => void {
  return function handleError(): void {
    handlers.onError('A conexão com o servidor falhou.');
  };
}

function buildCloseHandler(
  session: SocketSession,
  handlers: GameSocketHandlers,
): (event: CloseEvent) => void {
  return function handleClose(event: CloseEvent): void {
    stopTimers(session);
    handlers.onStatus('closed');
    handlers.onClose(session.deadBySilence ? ABNORMAL_CLOSE_CODE : event.code);
  };
}

/**
 * What the client does with the message of the server.
 */
function readPayload(
  payload: ServerPayload,
  session: SocketSession,
  handlers: GameSocketHandlers,
): void {
  if (payload.kind === 'state_snapshot') {
    handlers.onState(payload.state);
    return;
  }
  if (payload.kind === 'command_result') {
    // The answer of the server is matched by the request that it carries: an
    // answer that belongs to another request is not the answer of this one.
    if (payload.result.reqId !== session.selectReqId) {
      return;
    }
    handlers.onCommandResult(payload.result);
    return;
  }
  if (payload.kind === 'error') {
    handlers.onError(payload.message);
  }
}

function startPing(socket: WebSocket, session: SocketSession): void {
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
function startWatchdog(
  socket: WebSocket,
  session: SocketSession,
  handlers: GameSocketHandlers,
): void {
  stopWatchdog(session);
  session.watchdogTimer = setTimeout(function onSilence(): void {
    session.deadBySilence = true;
    handlers.onError(LIVENESS_MESSAGE);
    socket.close();
  }, session.livenessTimeoutMs);
}

function buildSocketUrl(baseUrl: string, ticket: string): string {
  const url = new globalThis.URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = WS_PATH;
  url.search = `ticket=${encodeURIComponent(ticket)}`;
  return url.toString();
}

function createRequestId(): string {
  requestCounter += 1;
  return `game-request-${requestCounter}`;
}

function sendMessage(socket: WebSocket, message: ClientMessage): void {
  if (socket.readyState !== globalThis.WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(message));
}

function stopTimers(session: SocketSession): void {
  stopPing(session);
  stopWatchdog(session);
}

function stopPing(session: SocketSession): void {
  if (session.pingTimer === null) {
    return;
  }
  clearInterval(session.pingTimer);
  session.pingTimer = null;
}

function stopWatchdog(session: SocketSession): void {
  if (session.watchdogTimer === null) {
    return;
  }
  clearTimeout(session.watchdogTimer);
  session.watchdogTimer = null;
}
