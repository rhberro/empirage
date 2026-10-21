import type { NewTrainerInput, Trainer } from '@creatures/contracts/trainer';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type {
  ApiDeps,
  DeleteTrainerResult,
  TrainerClientErrorCode,
  TrainerCreateResult,
  TrainerUpdateInput,
  TrainerUpdateResult,
} from '~/shared/api';
import { createApiDeps, readErrorCode, trainersQueryOptions } from '~/shared/api';
import { getAccessToken, useAuth } from '~/shared/auth';

import { useTrainerMutations } from './useTrainerMutations';
import { useTrainersSession } from './useTrainersSession';

const AUTHENTICATED_STATUS = 'AUTHENTICATED';

export type TrainersHook = {
  create(input: NewTrainerInput): Promise<TrainerCreateResult>;
  error: TrainerClientErrorCode | null;
  /** The list was already read in this session. */
  isLoaded: boolean;
  isLoading: boolean;
  refresh(): Promise<void>;
  remove(id: string): Promise<DeleteTrainerResult>;
  /** The trainer the player chose in the list. */
  selectedTrainerId: string | null;
  selectTrainer(id: string | null): void;
  trainers: Trainer[];
  update(id: string, input: TrainerUpdateInput): Promise<TrainerUpdateResult>;
};

/**
 * The trainers of the account.
 *
 * The list is the state of the server, so it lives in the query: the cache is
 * shared by the whole client, the request that is already running is awaited
 * instead of duplicated, and the loading and the error come with it.
 *
 * What belongs to the session — the trainer the player chose — stays in the
 * store.
 */
export function useTrainers(): TrainersHook {
  const auth = useAuth();
  const isAuthenticated = auth.status === AUTHENTICATED_STATUS;
  const deps = useMemo(buildDeps, []);
  const list = useQuery({ ...trainersQueryOptions(deps), enabled: isAuthenticated });
  const session = useTrainersSession(isAuthenticated, list.isSuccess);
  const mutations = useTrainerMutations(deps);
  const refetch = list.refetch;
  const refresh = useCallback(
    function refreshTrainers(): Promise<void> {
      return refetch().then(ignoreAnswer);
    },
    [refetch],
  );

  return {
    create: mutations.create,
    error: list.isError ? readErrorCode(list.error) : null,
    isLoaded: session.isLoaded,
    isLoading: isAuthenticated && list.isPending,
    refresh,
    remove: mutations.remove,
    selectTrainer: session.selectTrainer,
    selectedTrainerId: session.selectedTrainerId,
    trainers: list.data ?? [],
    update: mutations.update,
  };
}

function buildDeps(): ApiDeps {
  return createApiDeps(getAccessToken);
}

function ignoreAnswer(): void {
  void 0;
}
