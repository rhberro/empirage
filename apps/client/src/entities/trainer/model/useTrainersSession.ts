import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useStore } from 'zustand/react';

import { TRAINERS_QUERY_KEY } from '~/shared/api';

import {
  getTrainersStore,
  selectIsLoaded,
  selectMarkLoaded,
  selectReset,
  selectSelectedTrainerId,
  selectTrainerSelection,
} from './trainersStore';

export type TrainersSession = {
  /** The list of trainers was already read in this session. */
  isLoaded: boolean;
  selectTrainer(id: string | null): void;
  /** The trainer the player chose in the list. */
  selectedTrainerId: string | null;
};

/**
 * The session of the trainers.
 *
 * The list belongs to the server and lives in the query. What stays here is
 * what belongs to the session: the trainer the player chose, and the fact
 * that the list was already read.
 */
export function useTrainersSession(
  isAuthenticated: boolean,
  isListLoaded: boolean,
): TrainersSession {
  const queryClient = useQueryClient();
  const store = getTrainersStore();
  const isLoaded = useStore(store, selectIsLoaded);
  const markLoaded = useStore(store, selectMarkLoaded);
  const reset = useStore(store, selectReset);
  const selectTrainer = useStore(store, selectTrainerSelection);
  const selectedTrainerId = useStore(store, selectSelectedTrainerId);

  useEffect(rememberTheList(isListLoaded, markLoaded), [isListLoaded, markLoaded]);
  useEffect(forgetTheSession(isAuthenticated, queryClient, reset), [
    isAuthenticated,
    queryClient,
    reset,
  ]);

  return { isLoaded, selectTrainer, selectedTrainerId };
}

/**
 * The list that arrived is the list of the session: from here on, an empty
 * list means that the account has no trainer.
 */
function rememberTheList(isListLoaded: boolean, markLoaded: () => void): () => void {
  return function remember(): void {
    if (isListLoaded) {
      markLoaded();
    }
  };
}

/**
 * The list follows the session: it goes away when the session ends, so that
 * the next account that signs in on the same browser starts with nothing.
 */
function forgetTheSession(
  isAuthenticated: boolean,
  queryClient: ReturnType<typeof useQueryClient>,
  reset: () => void,
): () => void {
  return function forget(): void {
    if (isAuthenticated) {
      return;
    }
    reset();
    queryClient.removeQueries({ queryKey: TRAINERS_QUERY_KEY });
  };
}
