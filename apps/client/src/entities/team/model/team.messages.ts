import type { TeamErrorCode } from './team.types';

/**
 * The message of every code the team can answer with.
 *
 * The map is exhaustive: a code that enters the contract and does not enter
 * here breaks the build instead of falling into a message that is not its.
 */
export const TEAM_ERROR_MESSAGES: Record<TeamErrorCode, string> = {
  creature_not_found: 'Criatura não encontrada.',
  invalid_team_command: 'Comando de time inválido.',
  last_creature: 'O treinador precisa ter pelo menos uma criatura.',
  last_team_member: 'O time não pode ficar vazio.',
  team_full: 'O time já está com 5 criaturas.',
  trainer_not_found: 'Treinador não encontrado.',
  unauthenticated: 'Sessão expirada. Entre novamente.',
  unknown: 'Não foi possível concluir a ação. Tente novamente.',
};

/**
 * The message of a code, or nothing when there is no failure.
 *
 * The code is the fact and the message is what the interface shows, so the
 * view asks for the message instead of carrying the map.
 */
export function readTeamErrorMessage(code: TeamErrorCode | null): string | null {
  return code === null ? null : TEAM_ERROR_MESSAGES[code];
}
