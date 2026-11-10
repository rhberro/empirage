import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import {
  createCharacter,
  type CreateCharacterError,
  type CreateCharacterResult,
} from '../api/create-character';
import type { CreateCharacterOutput } from './create-character-schema';

async function createCharacterMutationFn(
  values: CreateCharacterOutput,
): Promise<CreateCharacterResult> {
  const result = await createCharacter(values);
  if (result.error) {
    throw result.error;
  }
  return result;
}

export function useCreateCharacter(): UseMutationResult<
  CreateCharacterResult,
  CreateCharacterError,
  CreateCharacterOutput
> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function onSuccess(): Promise<void> {
    const filters = { queryKey: ['characters'] };
    await queryClient.invalidateQueries(filters);
    await navigate('/characters');
  }
  const mutationOptions = { mutationFn: createCharacterMutationFn, onSuccess };
  return useMutation(mutationOptions);
}
