import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

export type TrainersStoreState = {
  /** The list of trainers was already read in this session. */
  isLoaded: boolean;
  /** The trainer the player chose in the list. */
  selectedTrainerId: string | null;
  markLoaded(): void;
  reset(): void;
  select(id: string | null): void;
};

export type TrainersStore = StoreApi<TrainersStoreState>;

/**
 * The store of the session of the trainers.
 *
 * The list itself is not here: it is the state of the server, and it lives in
 * the query, which is shared by every screen. What stays in the store is what
 * belongs to the session — the trainer the player chose and the fact that the
 * list was already read — and it goes away with the session.
 */
export function createTrainersStore(): TrainersStore {
  return createStore<TrainersStoreState>(buildInitializer());
}

function buildInitializer(): StateCreator<TrainersStoreState> {
  return function initialize(set): TrainersStoreState {
    return {
      isLoaded: false,
      markLoaded: buildMarkLoaded(set),
      reset: buildReset(set),
      select: buildSelect(set),
      selectedTrainerId: null,
    };
  };
}

export function getTrainersStore(): TrainersStore {
  if (store !== null) {
    return store;
  }
  store = createTrainersStore();
  return store;
}

export function selectIsLoaded(state: TrainersStoreState): boolean {
  return state.isLoaded;
}

export function selectSelectedTrainerId(state: TrainersStoreState): string | null {
  return state.selectedTrainerId;
}

export function selectMarkLoaded(state: TrainersStoreState): TrainersStoreState['markLoaded'] {
  return state.markLoaded;
}

export function selectReset(state: TrainersStoreState): TrainersStoreState['reset'] {
  return state.reset;
}

export function selectTrainerSelection(state: TrainersStoreState): TrainersStoreState['select'] {
  return state.select;
}

let store: TrainersStore | null = null;

function buildMarkLoaded(
  set: (partial: Partial<TrainersStoreState>) => void,
): TrainersStoreState['markLoaded'] {
  return function markLoaded(): void {
    set({ isLoaded: true });
  };
}

function buildReset(
  set: (partial: Partial<TrainersStoreState>) => void,
): TrainersStoreState['reset'] {
  return function reset(): void {
    set({ isLoaded: false, selectedTrainerId: null });
  };
}

function buildSelect(
  set: (partial: Partial<TrainersStoreState>) => void,
): TrainersStoreState['select'] {
  return function select(id: string | null): void {
    set({ selectedTrainerId: id });
  };
}
