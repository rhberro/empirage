import type { Gender, NewTrainerInput } from '@creatures/contracts/trainer';
import { createElement, type FormEvent } from 'react';
import type { Control } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import type { NavigateFunction } from 'react-router-dom';

import { newTrainerSchema } from '~/entities/trainer';
import type { TrainerClientErrorCode, TrainerCreateResult } from '~/shared/api';
import type { AlertInput } from '~/shared/ui/alert';
import { useZodForm } from '~/shared/ui/form';
import { Text } from '~/shared/ui/text';

const TRAINERS_PATH = '/trainers';
const ALERT_DURATION_MS = 6000;
const DEFAULT_GENDER: Gender = 'male';

const CREATE_ERROR_MESSAGES: Record<TrainerClientErrorCode, string> = {
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
  unknown: 'Não foi possível criar o treinador.',
};

export type NewTrainerForm = {
  control: Control<NewTrainerInput>;
  gender: Gender;
  handleBack: () => void;
  handleGenderChange: (gender: Gender) => void;
  handleStarterSelect: (id: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  starterError: string | null;
  starterId: string | null;
};

/**
 * O formulario de criacao de treinador.
 *
 * O genero e a criatura inicial nao sao campos de texto: eles vao para o
 * formulario com `setValue`, e o RHF devolve os dois com `useWatch`. O schema
 * e o mesmo que valida o pedido para o servidor, entao o que o jogador ve e o
 * que o servidor vai exigir.
 *
 * O botao de criar nao fica desabilitado enquanto o formulario esta
 * incompleto: ele fica desabilitado enquanto o pedido esta na fila. O que
 * falta e dito pelo proprio campo, e o primeiro campo invalido recebe o
 * foco.
 */
export function useNewTrainerForm(
  create: (input: NewTrainerInput) => Promise<TrainerCreateResult>,
  navigate: NavigateFunction,
  show: (input: AlertInput) => string,
): NewTrainerForm {
  const form = useZodForm(newTrainerSchema, {
    gender: DEFAULT_GENDER,
    name: '',
    starterSpeciesId: '',
  });
  const createHandlers = buildCreateHandlers(navigate, show);
  const gender = useWatch({ control: form.control, name: 'gender' });
  const starterId = useWatch({ control: form.control, name: 'starterSpeciesId' });

  function handleGenderChange(next: Gender): void {
    form.setValue('gender', next, { shouldDirty: true });
  }

  function handleStarterSelect(id: string): void {
    form.setValue('starterSpeciesId', id, { shouldDirty: true });
    form.clearErrors('starterSpeciesId');
  }

  function handleBack(): void {
    navigate(TRAINERS_PATH);
  }

  function onSubmit(values: NewTrainerInput): Promise<void> {
    return create(values).then(createHandlers.success, createHandlers.failure);
  }

  return {
    control: form.control,
    gender,
    handleBack,
    handleGenderChange,
    handleStarterSelect,
    handleSubmit: form.handleSubmit(onSubmit),
    isSubmitting: form.formState.isSubmitting,
    starterError: form.formState.errors.starterSpeciesId?.message ?? null,
    starterId: starterId === '' ? null : starterId,
  };
}

function buildCreateHandlers(
  navigate: NavigateFunction,
  show: (input: AlertInput) => string,
): {
  failure: () => void;
  success: (result: TrainerCreateResult) => void;
} {
  return {
    failure: function handleCreateFailure(): void {
      show(buildAlertInput(CREATE_ERROR_MESSAGES.unknown));
    },
    success: function handleCreateSuccess(result: TrainerCreateResult): void {
      if (result.ok) {
        navigate(TRAINERS_PATH, { replace: true });
        return;
      }
      show(buildAlertInput(CREATE_ERROR_MESSAGES[result.code]));
    },
  };
}

function buildAlertInput(message: string): AlertInput {
  return { content: createElement(Text, null, message), duration: ALERT_DURATION_MS, icon: null };
}
