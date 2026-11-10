import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '~/shared/api';

import type { CreateCharacterOutput } from '../model/create-character-schema';

export type CreateCharacterError = PostgrestError;

export type CreateCharacterResult = {
  error: CreateCharacterError | null;
};

export async function createCharacter(
  values: CreateCharacterOutput,
): Promise<CreateCharacterResult> {
  const parameters = {
    character_gender: values.gender,
    character_name: values.name,
  };
  const { error } = await supabase.rpc('create_character', parameters);
  return { error };
}
