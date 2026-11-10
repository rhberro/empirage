import { ApiError, apiRequest } from '~/shared/api';

import type { CreateCharacterOutput } from '../model/create-character-schema';

export type CreateCharacterError = ApiError;

export type CreateCharacterResult = {
  error: CreateCharacterError | null;
};

export async function createCharacter(
  values: CreateCharacterOutput,
): Promise<CreateCharacterResult> {
  const requestInit: RequestInit = { body: JSON.stringify(values), method: 'POST' };

  try {
    await apiRequest('/characters', requestInit);
    return { error: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error };
    }
    throw error;
  }
}
