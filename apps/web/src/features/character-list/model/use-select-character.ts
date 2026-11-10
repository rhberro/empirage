import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { selectCharacter } from '../api/select-character';

export function useSelectCharacter(): UseMutationResult<void, Error, string> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function onSuccess(): Promise<void> {
    const filters = { queryKey: ['characters'] };
    await queryClient.invalidateQueries(filters);
    await navigate('/game');
  }
  const mutationOptions = { mutationFn: selectCharacter, onSuccess };
  return useMutation(mutationOptions);
}
