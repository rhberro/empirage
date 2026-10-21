import type { PlayerState } from '@creatures/contracts/player';

import { decideRevision, playerStateSync } from '~/entities/team';
import type { PlayerStateSource } from '~/entities/team';
import { createApiDeps, requestPlayerState } from '~/shared/api';
import type { PlayerStateResult, TrainerClientErrorCode } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

const FAILURE_MESSAGE = 'Não foi possível carregar o estado do jogador.';
const NO_TRAINER_MESSAGE = 'Esta conta ainda não tem um treinador ativo.';
const TIMEOUT_MESSAGE = 'O servidor não respondeu a tempo.';
const LOAD_TIMEOUT_MS = 15000;

export type PlayerStateStatus = 'error' | 'idle' | 'loading' | 'ready';

/**
 * The outcome of a load: the player state arrived, the account has no active
 * trainer, or the request failed.
 */
export type PlayerStateLoadResult = 'failed' | 'no-trainer' | 'ready';

export type PlayerStateSnapshot = {
  /** The boot of the server that produced the state that is applied. */
  epoch: string | null;
  error: string | null;
  /** The revision of the state that is applied. */
  rev: number;
  state: PlayerState | null;
  status: PlayerStateStatus;
};

export type PlayerStateActions = {
  /** Applies a state that another consumer of the player state applied. */
  applyPublishedState(state: PlayerState, source: PlayerStateSource): void;
  applySnapshot(state: PlayerState): void;
  load(): Promise<PlayerStateLoadResult>;
  refresh(): Promise<PlayerStateLoadResult>;
};

export type PlayerStateStoreState = PlayerStateSnapshot & PlayerStateActions;

export type PlayerStateStoreOptions = {
  requestState?: () => Promise<PlayerStateResult>;
  timeoutMs?: number;
};

export type StoreWriter = {
  get(): PlayerStateStoreState;
  set(partial: Partial<PlayerStateStoreState>): void;
};

type TimeoutGuard = {
  cancel: () => void;
};

/**
 * The application of a state, guarded by the revision.
 *
 * A state of another epoch is a resync: the server restarted, and the client
 * takes what came. A state of the same epoch only applies when it is newer.
 * An old state is ignored: a push that arrives late does not put the client
 * back in the past.
 */
export function applyPlayerState(
  writer: StoreWriter,
  state: PlayerState,
  source: PlayerStateSource,
  publish: boolean,
): boolean {
  const current = writer.get();
  const decision = decideRevision(readRevision(current), { epoch: state.epoch, rev: state.rev });
  if (decision === 'ignore') {
    return false;
  }
  writer.set({ epoch: state.epoch, error: null, rev: state.rev, state, status: 'ready' });
  if (publish) {
    playerStateSync.publish(state, source);
  }
  return true;
}

/**
 * The load clears the state it replaces, the refresh keeps it: the game keeps
 * showing the last known state while the server answers.
 *
 * A request that never answers cannot leave the screen loading forever: the
 * guard gives up on it and the screen falls into the state of the lost
 * connection.
 */
export function buildLoader(
  writer: StoreWriter,
  clearState: boolean,
  timeoutMs: number,
  requestState: () => Promise<PlayerStateResult>,
): () => Promise<PlayerStateLoadResult> {
  return function load(): Promise<PlayerStateLoadResult> {
    writer.set(
      clearState
        ? { error: null, state: null, status: 'loading' }
        : { error: null, status: 'loading' },
    );
    const guard = buildTimeoutGuard(writer, clearState, timeoutMs);
    return requestState().then(
      buildSettledResult(guard, buildResultApplier(writer)),
      buildSettledResult(guard, buildUnexpectedFailure(writer)),
    );
  };
}

function buildTimeoutGuard(
  writer: StoreWriter,
  clearState: boolean,
  timeoutMs: number,
): TimeoutGuard {
  const timer = setTimeout(function giveUp(): void {
    const partial: Partial<PlayerStateStoreState> = { error: TIMEOUT_MESSAGE, status: 'error' };
    if (clearState) {
      partial.state = null;
    }
    writer.set(partial);
  }, timeoutMs);
  return {
    cancel: function cancel(): void {
      clearTimeout(timer);
    },
  };
}

function buildSettledResult<T>(
  guard: TimeoutGuard,
  apply: (value: T) => PlayerStateLoadResult,
): (value: T) => PlayerStateLoadResult {
  return function settle(value: T): PlayerStateLoadResult {
    guard.cancel();
    return apply(value);
  };
}

function buildResultApplier(
  writer: StoreWriter,
): (result: PlayerStateResult) => PlayerStateLoadResult {
  return function applyResult(result): PlayerStateLoadResult {
    if (!result.ok) {
      return applyFailure(writer, result.code);
    }
    if (result.state !== null && applyPlayerState(writer, result.state, 'rest', true)) {
      return 'ready';
    }
    // The server has nothing newer than the state that the client has: the
    // client keeps it, and the screen stops waiting.
    writer.set({ error: null, status: 'ready' });
    return 'ready';
  };
}

function buildUnexpectedFailure(writer: StoreWriter): () => PlayerStateLoadResult {
  return function applyUnexpectedFailure(): PlayerStateLoadResult {
    return applyFailure(writer, 'unknown');
  };
}

function applyFailure(writer: StoreWriter, code: TrainerClientErrorCode): PlayerStateLoadResult {
  if (code === 'trainer_not_found') {
    writer.set({ error: NO_TRAINER_MESSAGE, state: null, status: 'error' });
    return 'no-trainer';
  }
  writer.set({ error: FAILURE_MESSAGE, status: 'error' });
  return 'failed';
}

function readRevision(state: PlayerStateStoreState): { epoch: string; rev: number } | null {
  if (state.epoch === null) {
    return null;
  }
  return { epoch: state.epoch, rev: state.rev };
}

/**
 * The state of the player, read over REST.
 */
export function buildStateRequester(): () => Promise<PlayerStateResult> {
  return function requestState(): Promise<PlayerStateResult> {
    return requestPlayerState(createApiDeps(getAccessToken));
  };
}

export { LOAD_TIMEOUT_MS };
