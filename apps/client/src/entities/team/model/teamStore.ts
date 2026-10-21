import type { PlayerState } from '@creatures/contracts/player';
import { useStore } from 'zustand/react';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import { playerStateSync } from './playerStateSync';
import type { PlayerStateSource } from './playerStateSync';
import type { TeamCommand, TeamErrorCode } from './team.types';
import { applyTeamState } from './teamStateApply';
import type { TeamStateSnapshot } from './teamStateApply';

/**
 * The team of the player: the state of the server and the changes that are on
 * their way.
 *
 * The store lives outside the page because the storage, the backpack and the
 * team of the game are consumers of the same truth: the change the client
 * predicts has to reach the grid of the storage in the same instant it reaches
 * the row of the team.
 */
export type TeamStoreSnapshot = TeamStateSnapshot & {
  /** The refusal of the last command, when the server refused it. */
  error: TeamErrorCode | null;
};

export type TeamStoreActions = {
  /** Puts a change of the team in the list of the changes that are on their way. */
  addCommand(command: TeamCommand): void;
  /** Applies the state the channel of the game pushed. */
  applyPushedState(state: PlayerState): void;
  /** Applies the state the request over REST read. */
  applyRestState(state: PlayerState): void;
  /** Applies a state that another consumer of the player state applied. */
  applyPublishedState(state: PlayerState, source: PlayerStateSource): void;
  /** Forgets the changes that are on their way. */
  clearCommands(): void;
  /** Forgets the refusal of the last command. */
  clearError(): void;
  /** Forgets a change the server refused. */
  removeCommand(command: TeamCommand): void;
  /** Shows the refusal of a command. */
  setError(code: TeamErrorCode): void;
  /** Says whether the state of the server is being read. */
  setLoading(isLoading: boolean): void;
};

export type TeamStoreState = TeamStoreSnapshot & TeamStoreActions;

export type TeamStore = StoreApi<TeamStoreState>;

/**
 * One store for the whole client.
 *
 * The team belongs to the player, not to the screen that shows it: the state
 * the server pushes is the same for the storage, for the backpack and for the
 * game screen.
 */
export function createTeamStore(): TeamStore {
  return createStore<TeamStoreState>(buildInitializer());
}

export const teamStore: TeamStore = createTeamStore();

/**
 * The state the channel of the game pushed.
 *
 * The push is the truth: the change it carries confirms the prediction of the
 * client, the prediction is thrown away and the team of the server is the one
 * that stays.
 */
export function applyTeamSnapshot(state: PlayerState): void {
  playerStateSync.publish(state, 'push');
}

/**
 * The team follows the state of the player.
 *
 * The team is one of the consumers of the state of the player: whoever
 * applies it tells the others about it, and the team applies it too.
 */
playerStateSync.subscribe(function applyPublishedState(
  state: PlayerState,
  source: PlayerStateSource,
): void {
  teamStore.getState().applyPublishedState(state, source);
});

/**
 * Reads a piece of the state of the team.
 */
export function useTeamState<T>(selector: (state: TeamStoreState) => T): T {
  return useStore(teamStore, selector);
}

function buildInitializer(): StateCreator<TeamStoreState> {
  return function initialize(set, get): TeamStoreState {
    return {
      ...buildInitialSnapshot(),
      ...buildActions(set, get),
    };
  };
}

function buildInitialSnapshot(): TeamStoreSnapshot {
  return {
    commands: [],
    epoch: null,
    error: null,
    isLoaded: false,
    isLoading: false,
    isPushed: false,
    rev: 0,
    state: null,
  };
}

function buildActions(
  set: (partial: Partial<TeamStoreState>) => void,
  get: () => TeamStoreState,
): TeamStoreActions {
  return {
    addCommand: buildAddCommand(set, get),
    applyPublishedState: buildApplyPublishedState(set, get),
    applyPushedState: buildApplyPushedState(set, get),
    applyRestState: buildApplyRestState(set, get),
    clearCommands: buildClearCommands(set),
    clearError: buildClearError(set),
    removeCommand: buildRemoveCommand(set, get),
    setError: buildSetError(set),
    setLoading: buildSetLoading(set),
  };
}

function buildAddCommand(
  set: (partial: Partial<TeamStoreState>) => void,
  get: () => TeamStoreState,
): (command: TeamCommand) => void {
  return function addCommand(command: TeamCommand): void {
    set({ commands: [...get().commands, command], error: null });
  };
}

/**
 * The state the channel of the game pushed.
 *
 * The state of the server replaces the one the client had, and the changes
 * that the state already carries are confirmed: they leave the list of the
 * changes that are on their way.
 */
function buildApplyPushedState(
  set: (partial: Partial<TeamStoreState>) => void,
  get: () => TeamStoreState,
): (state: PlayerState) => void {
  return function applyPushedState(state: PlayerState): void {
    applyTeamState({ get, set }, state, 'push', true);
  };
}

/**
 * The state the request over REST read.
 *
 * The read is the reserve of the moments in which the channel of the game is
 * not there, so it never says that the channel carries the state.
 */
function buildApplyRestState(
  set: (partial: Partial<TeamStoreState>) => void,
  get: () => TeamStoreState,
): (state: PlayerState) => void {
  return function applyRestState(state: PlayerState): void {
    applyTeamState({ get, set }, state, 'rest', true);
  };
}

/**
 * A state that another consumer of the player state applied.
 *
 * The state is not published again: the one that published it already told
 * everyone about it.
 */
function buildApplyPublishedState(
  set: (partial: Partial<TeamStoreState>) => void,
  get: () => TeamStoreState,
): (state: PlayerState, source: PlayerStateSource) => void {
  return function applyPublishedState(state: PlayerState, source: PlayerStateSource): void {
    applyTeamState({ get, set }, state, source, false);
  };
}

function buildClearCommands(set: (partial: Partial<TeamStoreState>) => void): () => void {
  return function clearCommands(): void {
    set({ commands: [] });
  };
}

function buildClearError(set: (partial: Partial<TeamStoreState>) => void): () => void {
  return function clearError(): void {
    set({ error: null });
  };
}

/**
 * The change the server refused goes out of the list: the team of the server
 * is the one that shows again.
 */
function buildRemoveCommand(
  set: (partial: Partial<TeamStoreState>) => void,
  get: () => TeamStoreState,
): (command: TeamCommand) => void {
  return function removeCommand(command: TeamCommand): void {
    set({
      commands: get().commands.filter(function keepOther(entry: TeamCommand): boolean {
        return entry !== command;
      }),
    });
  };
}

function buildSetError(
  set: (partial: Partial<TeamStoreState>) => void,
): (code: TeamErrorCode) => void {
  return function setError(code: TeamErrorCode): void {
    set({ error: code });
  };
}

function buildSetLoading(
  set: (partial: Partial<TeamStoreState>) => void,
): (isLoading: boolean) => void {
  return function setLoading(isLoading: boolean): void {
    set({ isLoading });
  };
}
