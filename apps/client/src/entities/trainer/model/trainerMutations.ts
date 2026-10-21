import type { NewTrainerInput, Trainer } from '@creatures/contracts/trainer';
import type { QueryClient } from '@tanstack/react-query';

import type { ApiDeps } from '~/shared/api';
import {
  requestCreateTrainer,
  requestDeleteTrainer,
  requestUpdateTrainer,
  TRAINERS_QUERY_KEY,
} from '~/shared/api';
import type {
  DeleteTrainerResult,
  TrainerCreateResult,
  TrainerUpdateInput,
  TrainerUpdateResult,
} from '~/shared/api';

import { validateNewTrainer } from './trainer.schema';

/**
 * The writes of the list of trainers.
 *
 * Every write changes the list, so every write leaves the cache of the list
 * behind: the new list is written right away, and the server is asked again
 * to be sure.
 */
export function createTrainer(
  deps: ApiDeps,
  input: NewTrainerInput,
  queryClient: QueryClient,
): Promise<TrainerCreateResult> {
  const validationCode = validateNewTrainer(input);
  if (validationCode !== null) {
    return Promise.resolve({ code: validationCode, ok: false });
  }
  return requestCreateTrainer(deps, input).then(function applyCreate(
    result: TrainerCreateResult,
  ): TrainerCreateResult {
    if (result.ok) {
      addTrainerToCache(queryClient, result.trainer);
    }
    return result;
  });
}

/**
 * The edit of a trainer.
 *
 * A trainer that is not in the list does not exist for the account: the
 * server is not asked about something the client already knows.
 */
export function updateTrainer(
  deps: ApiDeps,
  id: string,
  input: TrainerUpdateInput,
  queryClient: QueryClient,
): Promise<TrainerUpdateResult> {
  if (isTrainerUnknown(queryClient, id)) {
    return Promise.resolve({ code: 'trainer_not_found', ok: false });
  }
  return requestUpdateTrainer(deps, id, input).then(function applyUpdate(
    result: TrainerUpdateResult,
  ): TrainerUpdateResult {
    if (result.ok) {
      replaceTrainerInCache(queryClient, result.trainer);
    }
    return result;
  });
}

/**
 * The exclusion of a trainer.
 */
export function deleteTrainer(
  deps: ApiDeps,
  id: string,
  queryClient: QueryClient,
): Promise<DeleteTrainerResult> {
  if (isTrainerUnknown(queryClient, id)) {
    return Promise.resolve({ code: 'trainer_not_found', ok: false });
  }
  return requestDeleteTrainer(deps, id).then(function applyDelete(
    result: DeleteTrainerResult,
  ): DeleteTrainerResult {
    if (result.ok) {
      removeTrainerFromCache(queryClient, id);
    }
    return result;
  });
}

/**
 * The list goes behind the change, and the server is asked again.
 *
 * The cache is written first so that the screen shows the change at once: the
 * request that follows is the confirmation, not the wait.
 */
function addTrainerToCache(queryClient: QueryClient, trainer: Trainer): void {
  queryClient.setQueryData<Trainer[]>(
    TRAINERS_QUERY_KEY,
    function add(trainers: Trainer[] | undefined): Trainer[] {
      const current = trainers ?? [];
      if (current.some(buildTrainerIdMatcher(trainer.id))) {
        return current;
      }
      return current.concat(trainer);
    },
  );
  invalidateTrainerList(queryClient);
}

function replaceTrainerInCache(queryClient: QueryClient, trainer: Trainer): void {
  queryClient.setQueryData<Trainer[]>(
    TRAINERS_QUERY_KEY,
    function replace(trainers: Trainer[] | undefined): Trainer[] {
      const current = trainers ?? [];
      return current.map(buildTrainerReplacer(trainer));
    },
  );
  invalidateTrainerList(queryClient);
}

function removeTrainerFromCache(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<Trainer[]>(
    TRAINERS_QUERY_KEY,
    function remove(trainers: Trainer[] | undefined): Trainer[] {
      const current = trainers ?? [];
      return current.filter(buildTrainerIdRejector(id));
    },
  );
  invalidateTrainerList(queryClient);
}

function invalidateTrainerList(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: TRAINERS_QUERY_KEY });
}

/**
 * Whether the client already knows that the trainer does not exist.
 *
 * A list that was never read says nothing: in that case the server decides.
 */
function isTrainerUnknown(queryClient: QueryClient, id: string): boolean {
  const trainers = queryClient.getQueryData<Trainer[]>(TRAINERS_QUERY_KEY);
  if (trainers === undefined) {
    return false;
  }
  return !trainers.some(buildTrainerIdMatcher(id));
}

function buildTrainerIdMatcher(id: string): (trainer: Trainer) => boolean {
  return function matchesId(trainer: Trainer): boolean {
    return trainer.id === id;
  };
}

function buildTrainerIdRejector(id: string): (trainer: Trainer) => boolean {
  return function rejectsId(trainer: Trainer): boolean {
    return trainer.id !== id;
  };
}

function buildTrainerReplacer(updated: Trainer): (trainer: Trainer) => Trainer {
  return function replaceTrainer(trainer: Trainer): Trainer {
    return trainer.id === updated.id ? updated : trainer;
  };
}
