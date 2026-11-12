import type { Character } from '~/entities/character';
import { apiRequest } from '~/shared/api';

export type Characters = Array<Character>;

export function getCharacters(): Promise<Characters> {
  return apiRequest<Characters>('/characters');
}
