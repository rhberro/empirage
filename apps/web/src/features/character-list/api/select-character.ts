import { apiRequest } from '~/shared/api';

export async function selectCharacter(characterId: string): Promise<void> {
  const path = `/characters/${encodeURIComponent(characterId)}/select`;
  const requestInit: RequestInit = { method: 'POST' };
  await apiRequest(path, requestInit);
}
