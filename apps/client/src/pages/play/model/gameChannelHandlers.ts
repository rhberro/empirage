import type { PlayerState } from '@creatures/contracts/player';

import { playerStateSync } from '~/entities/team';
import type { ChannelMachine } from '~/pages/play/model/gameChannelMachine';
import type { CommandResult } from '~/pages/play/model/gameProtocol';
import type {
  GameSocket,
  GameSocketHandlers,
  GameSocketStatus,
} from '~/pages/play/model/gameSocket';

/**
 * The close of the connection that another connection of the same account
 * took the place of.
 */
const REPLACED_CLOSE_CODE = 4001;

/**
 * How long the channel has to stay open for the backoff to start over.
 *
 * The counter of the attempts is zeroed when the channel holds, and not when
 * it opens: a server that accepts the connection and closes it right away
 * cannot become one attempt per second, forever.
 */
const STABILITY_MS = 5000;

/**
 * One attempt of opening the channel.
 */
export type Attempt = {
  /** The channel of this attempt. */
  socket: GameSocket | null;
  /** Whether the close of this attempt has to be ignored. */
  suppressed: boolean;
};

/**
 * The state of the channel between the attempts.
 */
export type ChannelState = {
  /** The attempt that is running. */
  attempt: Attempt | null;
  /** Whether the next close of the server is expected. */
  expectedClose: boolean;
  /** How many times the channel was opened again in a row. */
  retries: number;
  /** The timer of the wait between two attempts. */
  retryTimer: ReturnType<typeof setTimeout> | null;
  /** The attempt that is holding the channel open. */
  stableAttempt: Attempt | null;
  /** The timer that zeroes the counter of the attempts. */
  stabilityTimer: ReturnType<typeof setTimeout> | null;
  /** Whether the channel gave up. */
  stopped: boolean;
};

export type GameChannelHandlersDeps = {
  /** The state that the server pushed goes to the screen. */
  applySnapshot: (state: PlayerState) => void;
  /** The channel is gone for good: the screen asks the player to reconnect. */
  onLost: () => void;
  /** The channel is open. */
  onOpen: () => void;
  /** Something happened that the player has to know about. */
  onWarning: (message: string) => void;
  /** How long the channel has to stay open for the backoff to start over. */
  stabilityMs?: number;
};

/**
 * The handlers of an attempt.
 */
export function buildHandlers(
  deps: GameChannelHandlersDeps,
  state: ChannelState,
  attempt: Attempt,
  machine: ChannelMachine,
): GameSocketHandlers {
  return {
    onClose: buildCloseHandler(deps, state, attempt, machine),
    onCommandResult: buildCommandResultHandler(),
    onError: deps.onWarning,
    onState: deps.applySnapshot,
    onStatus: buildStatusHandler(deps, state, attempt),
  };
}

/**
 * The channel opened.
 *
 * The counter of the attempts is not zeroed here: the channel opened, but it
 * did not hold yet. The zeroing waits for the channel to stay open, so that a
 * server that accepts the connection and closes it right away does not turn
 * into one attempt per second, forever.
 */
function buildStatusHandler(
  deps: GameChannelHandlersDeps,
  state: ChannelState,
  attempt: Attempt,
): (status: GameSocketStatus) => void {
  return function handleStatus(status: GameSocketStatus): void {
    if (status !== 'open' || state.stopped) {
      return;
    }
    scheduleStabilityReset(state, attempt, deps.stabilityMs ?? STABILITY_MS);
    deps.onOpen();
  };
}

/**
 * The close of the channel.
 *
 * The close that follows a command of the player is expected, and the close
 * that says that another connection took the place of this one ends the
 * channel: reconnecting would throw that one down, and the two would take
 * turns throwing each other down.
 */
function buildCloseHandler(
  deps: GameChannelHandlersDeps,
  state: ChannelState,
  attempt: Attempt,
  machine: ChannelMachine,
): (code: number) => void {
  return function handleClose(code: number): void {
    clearStabilityTimer(state, attempt);
    if (attempt.suppressed || state.stopped) {
      return;
    }
    if (state.expectedClose) {
      state.stopped = true;
      return;
    }
    if (code === REPLACED_CLOSE_CODE) {
      state.stopped = true;
      deps.onLost();
      return;
    }
    machine.retry();
  };
}

/**
 * The zeroing of the counter of the attempts, when the channel holds.
 */
function scheduleStabilityReset(state: ChannelState, attempt: Attempt, stabilityMs: number): void {
  clearStabilityTimer(state, state.stableAttempt);
  state.stableAttempt = attempt;
  state.stabilityTimer = setTimeout(function onStable(): void {
    state.stabilityTimer = null;
    state.stableAttempt = null;
    if (state.stopped) {
      return;
    }
    state.retries = 0;
  }, stabilityMs);
}

/**
 * The cancellation of the zeroing, when the channel falls before it holds.
 */
function clearStabilityTimer(state: ChannelState, attempt: Attempt | null): void {
  if (attempt === null || state.stableAttempt !== attempt) {
    return;
  }
  if (state.stabilityTimer !== null) {
    clearTimeout(state.stabilityTimer);
    state.stabilityTimer = null;
  }
  state.stableAttempt = null;
}

/**
 * The answer to a command of the client.
 *
 * A command that the server refused left the state of the client behind: the
 * client asks for the state of the server, instead of keeping a state that
 * the server never had.
 */
function buildCommandResultHandler(): (result: CommandResult) => void {
  return function handleCommandResult(result: CommandResult): void {
    if (result.ok) {
      return;
    }
    void playerStateSync.requestFallback();
  };
}
