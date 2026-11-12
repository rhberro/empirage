import type { CharacterId } from '~/entities/character';
import { setSelectedCharacter } from '~/shared/session';

export function selectCharacter(characterId: CharacterId, userId: string): void {
  setSelectedCharacter(userId, characterId);
}
