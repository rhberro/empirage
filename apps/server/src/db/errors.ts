import type { TrainerErrorCode } from '@creatures/contracts/trainer';

import type { DatabaseError } from '~/db/types';
import { readTrainerErrorMessage } from '~/validation/trainer';

const UNIQUE_VIOLATION = '23505';
const RAISE_EXCEPTION = 'P0001';
const MAX_TRAINERS_MESSAGE = 'max_trainers_reached';
const STARTER_UNAVAILABLE_MESSAGE = 'starter_unavailable';
const CREATURE_NOT_FOUND_MESSAGE = 'creature_not_found';
const INVALID_TEAM_COMMAND_MESSAGE = 'invalid_team_command';
const LAST_CREATURE_MESSAGE = 'last_creature';
const LAST_TEAM_MEMBER_MESSAGE = 'last_team_member';
const TEAM_FULL_MESSAGE = 'team_full';
const TRAINER_NOT_FOUND_MESSAGE = 'trainer_not_found';
const INTERNAL_ERROR_CODE = 'internal_error';
const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor.';

export type ApiError = {
  code: string;
  message: string;
  status: number;
};

export function mapTrainerWriteError(error: DatabaseError): ApiError {
  if (error.code === UNIQUE_VIOLATION) {
    return buildTrainerError(409, 'name_taken');
  }
  if (error.code === RAISE_EXCEPTION) {
    if (error.message === MAX_TRAINERS_MESSAGE) {
      return buildTrainerError(409, 'max_trainers_reached');
    }
    if (error.message === STARTER_UNAVAILABLE_MESSAGE) {
      return buildTrainerError(400, 'starter_unavailable');
    }
  }
  return buildInternalError();
}

export function buildInternalError(): ApiError {
  return { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE, status: 500 };
}

/**
 * The team operations are transactional functions that refuse the change with
 * a raised exception, and the exception carries the reason of the refusal.
 */
export function mapTeamOperationError(error: DatabaseError): ApiError {
  if (error.code === RAISE_EXCEPTION) {
    if (error.message === CREATURE_NOT_FOUND_MESSAGE) {
      return buildTrainerError(404, 'creature_not_found');
    }
    if (error.message === INVALID_TEAM_COMMAND_MESSAGE) {
      return buildTrainerError(400, 'invalid_team_command');
    }
    if (error.message === LAST_CREATURE_MESSAGE) {
      return buildTrainerError(409, 'last_creature');
    }
    if (error.message === LAST_TEAM_MEMBER_MESSAGE) {
      return buildTrainerError(409, 'last_team_member');
    }
    if (error.message === TEAM_FULL_MESSAGE) {
      return buildTrainerError(409, 'team_full');
    }
    if (error.message === TRAINER_NOT_FOUND_MESSAGE) {
      return buildTrainerError(404, 'trainer_not_found');
    }
  }
  return buildInternalError();
}

function buildTrainerError(status: number, code: TrainerErrorCode): ApiError {
  return { code, message: readTrainerErrorMessage(code), status };
}
