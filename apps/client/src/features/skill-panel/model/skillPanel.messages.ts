import type { TrainerClientErrorCode } from '~/shared/api';

/**
 * The message of a command of the skill bar that the server refused.
 *
 * The map is exhaustive by construction: a new code in the contract breaks the
 * build until it has a message here.
 */
export const SKILL_COMMAND_MESSAGES: Record<TrainerClientErrorCode, string> = {
  creature_not_found: 'A criatura não foi encontrada.',
  invalid_gender: 'Gênero inválido.',
  invalid_name: 'Nome inválido.',
  invalid_starter: 'A criatura inicial informada é inválida.',
  invalid_team_command: 'Comando de time inválido.',
  invalid_trainer: 'Identificador de treinador inválido.',
  last_creature: 'O treinador precisa ter pelo menos uma criatura.',
  last_team_member: 'O time não pode ficar vazio.',
  max_trainers_reached: 'Você atingiu o limite de 5 treinadores.',
  name_taken: 'Nome indisponível.',
  rate_limited: 'Muitas tentativas. Tente novamente em alguns minutos.',
  starter_unavailable: 'A criatura inicial escolhida não está mais disponível.',
  swap_cooldown: 'A troca está em recarga. Aguarde alguns segundos.',
  team_full: 'O time está cheio.',
  trainer_not_found: 'Treinador não encontrado.',
  unauthenticated: 'Sessão expirada. Entre novamente.',
  unknown: 'Não foi possível mudar a carga da barra de habilidades.',
};
