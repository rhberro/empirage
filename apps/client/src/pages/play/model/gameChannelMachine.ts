import type { GameCommand } from '@creatures/contracts/game';
import type { PlayerState } from '@creatures/contracts/player';
import type { Tile } from '@creatures/contracts/world';

import { buildHandlers } from '~/pages/play/model/gameChannelHandlers';
import type { Attempt, ChannelState } from '~/pages/play/model/gameChannelHandlers';
import type { CommandResult, MoveResult } from '~/pages/play/model/gameProtocol';
import { connectGameSocket } from '~/pages/play/model/gameSocket';
import type { GameSocket, GameSocketOptions } from '~/pages/play/model/gameSocket';
import { computeBackoffDelay } from '~/pages/play/model/reconnectionBackoff';
import { createApiDeps, readApiBaseUrl, requestWsTicket } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

/**
 * How many times the client tries to open the channel again before it gives
 * up.
 *
 * The wait between the attempts grows, so the retries take about a minute: a
 * server that is down for longer than that is a server that the player has to
 * be told about.
 */
const MAX_RETRIES = 6;

const TICKET_WARNING = 'Não foi possível abrir a conexão com o servidor.';

export type GameChannelDeps = {
  /** The state that the server pushed goes to the screen. */
  applySnapshot: (state: PlayerState) => void;
  /** How long the client waits before the next attempt. */
  backoffDelay?: (attempt: number) => number;
  /** How the channel is opened. The tests give a channel of their own. */
  connect?: (options: GameSocketOptions) => GameSocket;
  /** The hunt ended: the state of the player is out of date. */
  onHuntEnded?: () => void;
  /** The channel is gone for good: the screen asks the player to reconnect. */
  onLost: () => void;
  /** The channel is open. */
  onOpen: () => void;
  /** Something happened that the player has to know about. */
  onWarning: (message: string) => void;
  /** How the ticket of the opening is asked for. */
  requestTicket?: () => Promise<string | null>;
  /** How long the channel has to stay open for the backoff to start over. */
  stabilityMs?: number;
  trainerId: string | null;
};

/**
 * The machine of the channel: the attempts, the waits and the closes.
 */
export type ChannelMachine = {
  /** Opens the channel, with a ticket that is new. */
  attempt(): void;
  /** The next close of the server is not expected after all. */
  cancelExpectedClose(): void;
  /** Ends the channel: the screen goes away. */
  close(): void;
  /** The next close of the server is expected. */
  expectServerClose(): void;
  /** Opens the channel right away, without waiting for the backoff. */
  reconnectNow(): void;
  /** Sends a command through the channel that is open. */
  requestCommand(command: GameCommand, reqId?: string): Promise<CommandResult>;
  /** Sends a move through the channel that is open. */
  requestMove(target: Tile, reqId?: string): Promise<MoveResult>;
  /** Waits and opens the channel again. */
  retry(): void;
};

/**
 * The machine of the channel, ready to open it.
 */
export function buildChannelMachine(deps: GameChannelDeps): ChannelMachine {
  const state: ChannelState = {
    attempt: null,
    expectedClose: false,
    retries: 0,
    retryTimer: null,
    stabilityTimer: null,
    stableAttempt: null,
    stopped: false,
  };
  const machine: ChannelMachine = {
    attempt: noop,
    cancelExpectedClose: buildCancelExpectedClose(state),
    close: buildClose(state),
    expectServerClose: buildExpectServerClose(state),
    reconnectNow: noop,
    requestCommand: buildRequestCommand(state),
    requestMove: buildRequestMove(state),
    retry: noop,
  };
  machine.attempt = buildAttempt(deps, state, machine);
  machine.reconnectNow = buildReconnectNow(state, machine);
  machine.retry = buildRetry(deps, state, machine);
  return machine;
}

/**
 * One attempt of opening the channel: a ticket, and the channel that it
 * opens.
 */
function buildAttempt(
  deps: GameChannelDeps,
  state: ChannelState,
  machine: ChannelMachine,
): () => void {
  const requestTicket = deps.requestTicket ?? askForTicket;
  return function attempt(): void {
    if (state.stopped || deps.trainerId === null) {
      return;
    }
    requestTicket().then(handleTicket, handleFailure);
  };

  function handleTicket(ticket: string | null): void {
    if (state.stopped) {
      return;
    }
    if (ticket === null) {
      deps.onWarning(TICKET_WARNING);
      machine.retry();
      return;
    }
    openSocket(ticket);
  }

  function handleFailure(): void {
    if (state.stopped) {
      return;
    }
    deps.onWarning(TICKET_WARNING);
    machine.retry();
  }

  function openSocket(ticket: string): void {
    const current: Attempt = { socket: null, suppressed: false };
    state.attempt = current;
    current.socket = openChannel(deps, state, current, ticket, machine);
  }
}

/**
 * The channel of an attempt, with the handlers that the attempt answers.
 */
function openChannel(
  deps: GameChannelDeps,
  state: ChannelState,
  attempt: Attempt,
  ticket: string,
  machine: ChannelMachine,
): GameSocket {
  const connect = deps.connect ?? connectGameSocket;
  return connect({
    baseUrl: readApiBaseUrl(),
    handlers: buildHandlers(deps, state, attempt, machine),
    ticket,
    trainerId: deps.trainerId ?? '',
  });
}

/**
 * A move asked before the channel is open is refused: the move dies with the
 * channel, and a promise that waits for an answer that cannot come would hang.
 */
const CHANNEL_CLOSED_MESSAGE = 'A conexão com o servidor não está aberta.';

/**
 * The move of the player, through the socket of the attempt that is open.
 */
function buildRequestMove(
  state: ChannelState,
): (target: Tile, reqId?: string) => Promise<MoveResult> {
  return function requestMove(target: Tile, reqId?: string): Promise<MoveResult> {
    const socket = state.attempt?.socket ?? null;
    if (socket === null) {
      return Promise.reject(new Error(CHANNEL_CLOSED_MESSAGE));
    }
    return socket.requestMove(target, reqId);
  };
}

/**
 * A command of the player, through the socket of the attempt that is open.
 */
function buildRequestCommand(
  state: ChannelState,
): (command: GameCommand, reqId?: string) => Promise<CommandResult> {
  return function requestCommand(command: GameCommand, reqId?: string): Promise<CommandResult> {
    const socket = state.attempt?.socket ?? null;
    if (socket === null) {
      return Promise.reject(new Error(CHANNEL_CLOSED_MESSAGE));
    }
    return socket.requestCommand(command, reqId);
  };
}

/**
 * The wait before the next attempt.
 */
function buildRetry(
  deps: GameChannelDeps,
  state: ChannelState,
  machine: ChannelMachine,
): () => void {
  return function retry(): void {
    if (state.stopped) {
      return;
    }
    if (state.retries >= MAX_RETRIES) {
      state.stopped = true;
      deps.onLost();
      return;
    }
    const delay = backoffDelay(deps, state.retries);
    state.retries += 1;
    state.retryTimer = setTimeout(function openAgain(): void {
      state.retryTimer = null;
      state.attempt = null;
      machine.attempt();
    }, delay);
  };
}

function buildClose(state: ChannelState): () => void {
  return function close(): void {
    state.stopped = true;
    clearRetryTimer(state);
    closeCurrentSocket(state);
  };
}

function buildExpectServerClose(state: ChannelState): () => void {
  return function expectServerClose(): void {
    state.expectedClose = true;
  };
}

function buildCancelExpectedClose(state: ChannelState): () => void {
  return function cancelExpectedClose(): void {
    state.expectedClose = false;
  };
}

/**
 * The player asked to reconnect: the backoff starts over and the channel
 * opens right away.
 */
function buildReconnectNow(state: ChannelState, machine: ChannelMachine): () => void {
  return function reconnectNow(): void {
    state.stopped = false;
    state.expectedClose = false;
    state.retries = 0;
    clearRetryTimer(state);
    closeCurrentSocket(state);
    machine.attempt();
  };
}

function closeCurrentSocket(state: ChannelState): void {
  const attempt = state.attempt;
  if (attempt === null) {
    return;
  }
  attempt.suppressed = true;
  attempt.socket?.close();
  state.attempt = null;
}

function clearRetryTimer(state: ChannelState): void {
  if (state.retryTimer === null) {
    return;
  }
  clearTimeout(state.retryTimer);
  state.retryTimer = null;
}

function backoffDelay(deps: GameChannelDeps, attempt: number): number {
  const delay = deps.backoffDelay ?? computeBackoffDelay;
  return delay(attempt);
}

/**
 * The ticket that opens the channel.
 *
 * The ticket is of one use: an attempt that fails asks for a new one, and
 * never repeats the one that the server refused.
 */
function askForTicket(): Promise<string | null> {
  return requestWsTicket(createApiDeps(getAccessToken)).then(function readTicket(result):
    | string
    | null {
    return result.ok ? result.ticket : null;
  });
}

function noop(): void {
  void 0;
}
