const SELECTED_CHARACTER_STORAGE_KEY = 'empirage.selected-character';

type SelectedCharacter = { characterId: string; userId: string };

function isSelectedCharacter(value: unknown): value is SelectedCharacter {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const selectedCharacter = value as Partial<SelectedCharacter>;
  return (
    typeof selectedCharacter.characterId === 'string' &&
    typeof selectedCharacter.userId === 'string'
  );
}

export function getSelectedCharacter(userId: string): string | null {
  const storedValue = globalThis.localStorage.getItem(SELECTED_CHARACTER_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isSelectedCharacter(parsedValue) || parsedValue.userId !== userId) {
      return null;
    }
    return parsedValue.characterId;
  } catch {
    globalThis.localStorage.removeItem(SELECTED_CHARACTER_STORAGE_KEY);
    return null;
  }
}

export function setSelectedCharacter(userId: string, characterId: string): void {
  const selectedCharacter: SelectedCharacter = { characterId, userId };
  globalThis.localStorage.setItem(
    SELECTED_CHARACTER_STORAGE_KEY,
    JSON.stringify(selectedCharacter),
  );
}

export function clearSelectedCharacter(): void {
  globalThis.localStorage.removeItem(SELECTED_CHARACTER_STORAGE_KEY);
}
