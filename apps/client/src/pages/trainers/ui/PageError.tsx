import type { ReactElement } from 'react';

import type { TrainerClientErrorCode } from '~/shared/api';
import { Text } from '~/shared/ui/text';

const PAGE_ERROR_MESSAGES: Record<TrainerClientErrorCode, string> = {
  creature_not_found: 'Criatura não encontrada.',
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
  unknown: 'Não foi possível carregar os treinadores.',
};

const ENTER_ERROR_MESSAGES: Record<TrainerClientErrorCode, string> = {
  creature_not_found: 'Criatura não encontrada.',
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
  unknown: 'Não foi possível entrar com este treinador.',
};

export function PageError(props: PageErrorProps): ReactElement {
  const { code, context = 'list' } = props;
  const messages = context === 'enter' ? ENTER_ERROR_MESSAGES : PAGE_ERROR_MESSAGES;
  return (
    <Text color="fg.error" textAlign="center" variant="body">
      {messages[code]}
    </Text>
  );
}

export type PageErrorProps = {
  code: TrainerClientErrorCode;
  context?: 'enter' | 'list';
};
