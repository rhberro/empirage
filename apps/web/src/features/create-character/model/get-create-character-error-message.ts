import type { CreateCharacterError } from '../api/create-character';

export function getCreateCharacterErrorMessage(error: CreateCharacterError): string {
  if (error.code === 'character_limit_reached') {
    return 'Você atingiu o limite de 5 personagens.';
  }
  if (error.code === 'character_name_unavailable') {
    return 'Nome indisponível.';
  }
  return 'Não foi possível criar o personagem. Tente novamente.';
}
