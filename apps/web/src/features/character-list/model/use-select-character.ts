import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import type { CharacterId } from '~/entities/character';
import { selectAuthSession, useAuthStore } from '~/shared/auth';

import { selectCharacter } from '../api/select-character';

export function useSelectCharacter(): UseMutationResult<void, Error, CharacterId> {
  const navigate = useNavigate();
  const session = useAuthStore(selectAuthSession);
  const userId = session ? session.user.id : null;
  function mutationFunction(characterId: CharacterId): Promise<void> {
    if (!userId) {
      throw new Error('Authentication is required to select a character.');
    }
    selectCharacter(characterId, userId);
    return Promise.resolve();
  }
  async function onSuccess(): Promise<void> {
    await navigate('/game');
  }
  const mutationOptions = { mutationFn: mutationFunction, onSuccess };
  return useMutation(mutationOptions);
}
