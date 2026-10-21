import type { PlayerState } from '@creatures/contracts/player';
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand/react';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import { playerStateSync } from '~/entities/team';
import type { PlayerStateSource } from '~/entities/team';
import {
  applyPlayerState,
  buildLoader,
  buildStateRequester,
  LOAD_TIMEOUT_MS,
} from '~/pages/play/model/playerStateStore';
import type {
  PlayerStateActions,
  PlayerStateLoadResult,
  PlayerStateSnapshot,
  PlayerStateStatus,
  PlayerStateStoreOptions,
  PlayerStateStoreState,
  StoreWriter,
} from '~/pages/play/model/playerStateStore';
import type { PlayerStateResult } from '~/shared/api';

export type {
  PlayerStateLoadResult,
  PlayerStateSnapshot,
  PlayerStateStatus,
} from '~/pages/play/model/playerStateStore';

export type PlayerStateStore = StoreApi<PlayerStateStoreState>;

export type PlayerStateView = {
  applySnapshot: (state: PlayerState) => void;
  error: string | null;
  load: () => Promise<PlayerStateLoadResult>;
  refresh: () => Promise<PlayerStateLoadResult>;
  state: PlayerState | null;
  status: PlayerStateStatus;
};

export function createPlayerStateStore(options: PlayerStateStoreOptions = {}): PlayerStateStore {
  const timeoutMs = options.timeoutMs ?? LOAD_TIMEOUT_MS;
  const requestState = options.requestState ?? buildStateRequester();
  return createStore<PlayerStateStoreState>(buildInitializer(timeoutMs, requestState));
}

/**
 * One store per page.
 *
 * The store lives in the page because the player state belongs to the screen
 * of the game: it is loaded when the screen opens and thrown away with it.
 */
export function usePlayerStateStore(): PlayerStateStore {
  const ref = useRef<PlayerStateStore | null>(null);
  if (ref.current === null) {
    ref.current = createPlayerStateStore();
  }
  return ref.current;
}

/**
 * The state of the player, as the screen reads it.
 *
 * The state carries the team, the storage, the backpack, the creature in the
 * field and its abilities, and the wallet and the stamina of the trainer. The
 * signature of the hook does not change: the state is the contract, and the
 * contract grew.
 */
export function usePlayerState(store: PlayerStateStore): PlayerStateView {
  const applySnapshot = useStore(store, selectApplySnapshot);
  const error = useStore(store, selectError);
  const load = useStore(store, selectLoad);
  const refresh = useStore(store, selectRefresh);
  const state = useStore(store, selectState);
  const status = useStore(store, selectStatus);
  useEffect(subscribeToPlayerState(store), [store]);
  return { applySnapshot, error, load, refresh, state, status };
}

/**
 * The screen follows the state of the player.
 *
 * The state that another consumer applied — the team, the panel of abilities —
 * is also the state of the screen: nobody reads a state that is out of date.
 */
function subscribeToPlayerState(store: PlayerStateStore): () => void {
  return function subscribe(): () => void {
    return playerStateSync.subscribe(function applyPublishedState(
      state: PlayerState,
      source: PlayerStateSource,
    ): void {
      store.getState().applyPublishedState(state, source);
    });
  };
}

function buildInitializer(
  timeoutMs: number,
  requestState: () => Promise<PlayerStateResult>,
): StateCreator<PlayerStateStoreState> {
  return function initialize(set, get): PlayerStateStoreState {
    const writer = { get, set };
    return {
      ...buildInitialSnapshot(),
      ...buildActions(writer, timeoutMs, requestState),
    };
  };
}

function buildInitialSnapshot(): PlayerStateSnapshot {
  return { epoch: null, error: null, rev: 0, state: null, status: 'idle' };
}

function buildActions(
  writer: StoreWriter,
  timeoutMs: number,
  requestState: () => Promise<PlayerStateResult>,
): PlayerStateActions {
  return {
    applyPublishedState: buildApplyPublishedState(writer),
    applySnapshot: buildApplySnapshot(writer),
    load: buildLoader(writer, true, timeoutMs, requestState),
    refresh: buildLoader(writer, false, timeoutMs, requestState),
  };
}

function buildApplySnapshot(writer: StoreWriter): (state: PlayerState) => void {
  return function applySnapshot(state: PlayerState): void {
    applyPlayerState(writer, state, 'push', true);
  };
}

/**
 * A state that another consumer of the player state applied.
 *
 * The state is not published again: the one that published it already told
 * everyone about it.
 */
function buildApplyPublishedState(
  writer: StoreWriter,
): (state: PlayerState, source: PlayerStateSource) => void {
  return function applyPublishedState(state: PlayerState, source: PlayerStateSource): void {
    applyPlayerState(writer, state, source, false);
  };
}

function selectApplySnapshot(state: PlayerStateStoreState): PlayerStateActions['applySnapshot'] {
  return state.applySnapshot;
}

function selectError(state: PlayerStateStoreState): string | null {
  return state.error;
}

function selectLoad(state: PlayerStateStoreState): PlayerStateActions['load'] {
  return state.load;
}

function selectRefresh(state: PlayerStateStoreState): PlayerStateActions['refresh'] {
  return state.refresh;
}

function selectState(state: PlayerStateStoreState): PlayerState | null {
  return state.state;
}

function selectStatus(state: PlayerStateStoreState): PlayerStateStatus {
  return state.status;
}
