import type { Trainer } from '@creatures/contracts/trainer';
import type { UseQueryOptions } from '@tanstack/react-query';

import type { ApiDeps } from '~/shared/api/client';
import type { TrainerListResult } from '~/shared/api/endpoints/trainer';
import { requestTrainerList } from '~/shared/api/endpoints/trainer';
import { ApiRequestError } from '~/shared/api/http';

/**
 * The key of the list of trainers.
 *
 * The key is shared by every screen that shows the list: it is what makes the
 * two requests of the login one single request.
 */
export const TRAINERS_QUERY_KEY = ['trainers'] as const;

export type TrainersQueryOptions = UseQueryOptions<
  Trainer[],
  Error,
  Trainer[],
  typeof TRAINERS_QUERY_KEY
>;

/**
 * The list of the trainers of the account.
 *
 * The list changes whenever a trainer is created, edited or deleted, so it
 * is never stale on its own: it is invalidated by the mutation that changed
 * it.
 */
export function trainersQueryOptions(deps: ApiDeps): TrainersQueryOptions {
  return {
    queryFn: fetchTrainers(deps),
    queryKey: TRAINERS_QUERY_KEY,
    staleTime: 0,
  };
}

function fetchTrainers(deps: ApiDeps): () => Promise<Trainer[]> {
  return function fetchTrainerList(): Promise<Trainer[]> {
    return requestTrainerList(deps).then(readTrainers);
  };
}

function readTrainers(result: TrainerListResult): Trainer[] {
  if (!result.ok) {
    throw new ApiRequestError(result.code);
  }
  return result.trainers;
}
