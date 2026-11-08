import { supabase } from '~/shared/api';

export type Character = {
  avatar_url: string | null;
  gender: string;
  id: string;
  level: number;
  name: string;
};

export type Characters = Array<Character>;

export async function getCharacters(): Promise<Characters> {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, level, gender, avatar_url');

  if (error) {
    throw error;
  }

  return data;
}
