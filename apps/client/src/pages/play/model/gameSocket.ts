import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { GameCommand } from '@creatures/contracts/game';
import type { HuntDelta, HuntEndedMessage } from '@creatures/contracts/huntSim';
import type { PlayerState } from '@creatures/contracts/player';
import type { Tile } from '@creatures/contracts/world';

import type { HuntSnapshot } from '~/entities/hunt/model/huntStore';
import {
  COMMAND_CLOSED_MESSAGE,
  COMMAND_TIMEOUT_MS,
  createCommandRequests,
} from '~/pages/play/model/commandRequests';
import type { CommandRequests } from '~/pages/play/model/commandRequests';
import { parseServerMessage, readProtocolFailureMessage } from '~/pages/play/model/gameProtocol';
import type {
  ActorLeaveMessage,
  ActorUpdateMessage,
  CommandResult,
  MoveResult,
  ServerPayload,
  WorldStateMessage,
} from '~/pages/play/model/gameProtocol';
import {
  buildSocketUrl,
  createConnectionSession,
  createRequestId,
  LIVENESS_MESSAGE,
  sendMessage,
  startPing,
  startWatchdog,
  stopTimers,
} from '~/pages/play/model/gameSocketConnection';
import type { ConnectionSession } from '~/pages/play/model/gameSocketConnection';
import { buildRequestCommand, buildRequestMove } from '~/pages/play/model/gameSocketRequests';
import {
  createMoveRequests,
  MOVE_CLOSED_MESSAGE,
  MOVE_TIMEOUT_MS,
} from '~/pages/play/model/moveRequests';
import type { MoveRequests } from '~/pages/play/model/moveRequests';

/**
 * The close of a connection that died without the server saying why.
 */
const ABNORMAL_CLOSE_CODE = 1006;

export type GameSocketStatus = 'closed' | 'connecting' | 'open';

export type GameSocketHandlers = {
  /** The actor that left the city is no longer around. */
  onActorLeave(leave: ActorLeaveMessage): void;
  /** An actor entered the city or started a step. */
  onActorUpdate(update: ActorUpdateMessage): void;
  /** The channel is closed, with the code that says why. */
  onClose(code: number): void;
  /** The server answered a command of the client. */
  onCommandResult(result: CommandResult): void;
  /** Something happened that the player has to know about. */
  onError(message: string): void;
  /** What changed in the hunt since the previous message. */
  onHuntDelta(delta: HuntDelta): void;
  /** The hunt ended, with the final accounting and the reason. */
  onHuntEnded(ended: HuntEndedMessage): void;
  /** The state of the hunt when the connection entered or reconnected. */
  onHuntState(snapshot: HuntSnapshot): void;
  /** The server answered a move, with the walk it planned. */
  onMoveResult(result: MoveResult): void;
  /** The server answered the clock ping. */
  onPong(pong: { sentAt: number; serverNow: number }): void;
  /** The server pushed the state of the player. */
  onState(state: PlayerState): void;
  /** The state of the channel changed. */
  onStatus(status: GameSocketStatus): void;
  /** The server pushed the dynamic part of the world. */
  onWorldState(world: WorldStateMessage): void;
};

export type GameSocket = {
  close(): void;
  /** Sends a command and resolves with the answer the server gives to it. */
  requestCommand(command: GameCommand, reqId?: string): Promise<CommandResult>;
  /** Sends a move and resolves with the answer the server gives to it. */
  requestMove(target: Tile, reqId?: string): Promise<MoveResult>;
};

export type GameSocketOptions = {
  baseUrl: string;
  /** How long the client waits for the answer to a command. */
  commandTimeoutMs?: number;
  handlers: GameSocketHandlers;
  /** How often the client says that it is alive. */
  pingIntervalMs?: number;
  /** How long the client accepts the silence of the server. */
  livenessTimeoutMs?: number;
  /** How long the client waits for the answer to a move. */
  moveTimeoutMs?: number;
  /** The ticket that opens the channel: the token of the account does not travel in the address. */
  ticket: string;
  trainerId: string;
};

/**
 * What the client keeps while the channel is open.
 */
type SocketSession = ConnectionSession & {
  /** The commands that wait for the answer of the server. */
  commands: CommandRequests;
  /** The moves that wait for the answer of the server. */
  moves: MoveRequests;
  /** The request of the selection of the trainer. */
  selectReqId: string;
};

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
    ...createConnectionSession(options),
    commands: createCommandRequests(options.commandTimeoutMs ?? COMMAND_TIMEOUT_MS),
    moves: createMoveRequests(options.moveTimeoutMs ?? MOVE_TIMEOUT_MS),
    selectReqId: createRequestId(),
  };

  handlers.onStatus('connecting');

  socket.addEventListener('open', buildOpenHandler(socket, session, handlers, trainerId));
  socket.addEventListener('message', buildMessageHandler(socket, session, handlers));
  socket.addEventListener('error', buildErrorHandler(handlers));
  socket.addEventListener('close', buildCloseHandler(session, handlers));

  return {
    close: function close(): void {
      stopTimers(session);
      session.commands.rejectAll(COMMAND_CLOSED_MESSAGE);
      session.moves.rejectAll(MOVE_CLOSED_MESSAGE);
      socket.close();
    },
    requestCommand: buildRequestCommand(socket, session.commands),
    requestMove: buildRequestMove(socket, session.moves),
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
    startWatchdog(socket, session, buildSilenceHandler(session, handlers));
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
    startWatchdog(socket, session, buildSilenceHandler(session, handlers));
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
    session.commands.rejectAll(COMMAND_CLOSED_MESSAGE);
    session.moves.rejectAll(MOVE_CLOSED_MESSAGE);
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
  if (readHuntMessage(payload, handlers)) {
    return;
  }
  if (payload.kind === 'pong') {
    handlers.onPong({ sentAt: payload.sentAt, serverNow: payload.serverNow });
    return;
  }
  if (payload.kind === 'state_snapshot') {
    handlers.onState(payload.state);
    return;
  }
  if (payload.kind === 'command_result') {
    // The answer of the server is matched by the request that it carries: the
    // selection of the trainer has its own handler; every other answer settles
    // the command that is waiting for it.
    if (payload.result.reqId === session.selectReqId) {
      handlers.onCommandResult(payload.result);
      return;
    }
    session.commands.settle(payload.result);
    return;
  }
  if (payload.kind === 'world_state') {
    handlers.onWorldState(payload.world);
    return;
  }
  if (payload.kind === 'move_result') {
    session.moves.settle(payload.result);
    handlers.onMoveResult(payload.result);
    return;
  }
  if (payload.kind === 'actor_update') {
    handlers.onActorUpdate(payload.update);
    return;
  }
  if (payload.kind === 'actor_leave') {
    handlers.onActorLeave(payload.leave);
    return;
  }
  if (payload.kind === 'error') {
    handlers.onError(payload.message);
  }
}

/**
 * The hunt messages, read before the rest: they are the branch the hunt grew
 * out of the channel and they are dispatched by their own handler.
 */
function readHuntMessage(payload: ServerPayload, handlers: GameSocketHandlers): boolean {
  if (payload.kind === 'hunt_state') {
    handlers.onHuntState(payload.snapshot);
    return true;
  }
  if (payload.kind === 'hunt_delta') {
    handlers.onHuntDelta(payload.delta);
    return true;
  }
  if (payload.kind === 'hunt_ended') {
    handlers.onHuntEnded(payload.ended);
    return true;
  }
  return false;
}

/**
 * The server stopped answering: the connection is dead, and the reason is
 * said to the player before the socket is closed.
 */
function buildSilenceHandler(session: SocketSession, handlers: GameSocketHandlers): () => void {
  return function handleSilence(): void {
    session.deadBySilence = true;
    handlers.onError(LIVENESS_MESSAGE);
  };
}
