import { apiRequest } from '~/shared/api';

export type Character = {
  avatar_url: string | null;
  gender: string;
  id: string;
  is_selected: boolean;
  level: number;
  name: string;
};

export type Characters = Array<Character>;

export function getCharacters(): Promise<Characters> {
  return apiRequest<Characters>('/characters');
}
