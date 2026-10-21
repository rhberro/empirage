import type { NewTrainerInput } from '@creatures/contracts/trainer';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type {
  ApiDeps,
  DeleteTrainerResult,
  TrainerCreateResult,
  TrainerUpdateInput,
  TrainerUpdateResult,
} from '~/shared/api';

import { createTrainer, deleteTrainer, updateTrainer } from './trainerMutations';

export type TrainerMutations = {
  create(input: NewTrainerInput): Promise<TrainerCreateResult>;
  remove(id: string): Promise<DeleteTrainerResult>;
  update(id: string, input: TrainerUpdateInput): Promise<TrainerUpdateResult>;
};

/**
 * The writes of the list of trainers.
 *
 * Every write leaves the cache of the list behind, so the screen shows the
 * change at once and the server is asked again to confirm it.
 */
export function useTrainerMutations(deps: ApiDeps): TrainerMutations {
  const queryClient = useQueryClient();

  const create = useCallback(
    function createTrainerOfAccount(input: NewTrainerInput): Promise<TrainerCreateResult> {
      return createTrainer(deps, input, queryClient);
    },
    [deps, queryClient],
  );
  const remove = useCallback(
    function removeTrainerOfAccount(id: string): Promise<DeleteTrainerResult> {
      return deleteTrainer(deps, id, queryClient);
    },
    [deps, queryClient],
  );
  const update = useCallback(
    function updateTrainerOfAccount(
      id: string,
      input: TrainerUpdateInput,
    ): Promise<TrainerUpdateResult> {
      return updateTrainer(deps, id, input, queryClient);
    },
    [deps, queryClient],
  );

  return { create, remove, update };
}
