import type { Gender, NewTrainerInput, TrainerErrorCode } from '@creatures/contracts/trainer';
import { z } from 'zod';

const GENDERS: [Gender, Gender] = ['male', 'female'];
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 15;
const NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;
const DIACRITICS_PATTERN = /[\u0300-\u036F]/gu;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const FIELD_ERROR_CODES: Record<string, TrainerErrorCode> = {
  gender: 'invalid_gender',
  name: 'invalid_name',
  starterSpeciesId: 'invalid_starter',
};

const ERROR_MESSAGES: Record<TrainerErrorCode, string> = {
  creature_not_found: 'Criatura não encontrada.',
  invalid_gender: 'O gênero deve ser "male" ou "female".',
  invalid_name:
    'O nome deve ter entre 3 e 15 caracteres e usar apenas letras, números, espaços, traços ou underscores.',
  invalid_starter: 'A criatura inicial informada é inválida.',
  invalid_team_command: 'Comando de time inválido.',
  invalid_trainer: 'Identificador de treinador inválido.',
  last_creature: 'O treinador precisa ter pelo menos uma criatura.',
  last_team_member: 'O time não pode ficar vazio.',
  max_trainers_reached: 'A conta já atingiu o limite de 5 treinadores.',
  name_taken: 'Já existe um treinador com esse nome.',
  starter_unavailable: 'A criatura inicial escolhida não está mais disponível.',
  swap_cooldown: 'A troca de criatura está em espera por 5 segundos.',
  team_full: 'O time já está com 5 criaturas.',
  trainer_not_found: 'Treinador não encontrado.',
  unauthenticated: 'Token inválido ou ausente.',
};

export type TrainerValidation =
  | { ok: true; value: NewTrainerInput }
  | { ok: false; code: TrainerErrorCode; message: string };

/**
 * Whether a value has the shape of an identifier the database accepts.
 *
 * The ids reach Postgres as a filter, so a value that is not a uuid would
 * make the query itself fail. Checking the shape before the query keeps a
 * malformed input a bad request instead of a server error.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export type TrainerUpdateInput = {
  gender?: Gender;
  name?: string;
};

export type TrainerUpdateValidation =
  | { ok: true; value: TrainerUpdateInput }
  | { ok: false; code: TrainerErrorCode; message: string };

export const newTrainerRequestSchema = z.object({
  gender: z.enum(GENDERS) satisfies z.ZodType<Gender>,
  name: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH).regex(NAME_PATTERN),
  starterSpeciesId: z.string().uuid(),
}) satisfies z.ZodType<NewTrainerInput>;

export const updateTrainerRequestSchema = z
  .object({
    gender: z.enum(GENDERS).optional() satisfies z.ZodType<Gender | undefined>,
    name: z
      .string()
      .trim()
      .min(NAME_MIN_LENGTH)
      .max(NAME_MAX_LENGTH)
      .regex(NAME_PATTERN)
      .optional(),
  })
  .refine(hasEditableField);

export function validateNewTrainer(body: unknown): TrainerValidation {
  const result = newTrainerRequestSchema.safeParse(body);
  if (!result.success) {
    const [issue] = result.error.issues;
    const code = issue === undefined ? 'invalid_name' : readIssueCode(issue);
    return { code, message: readTrainerErrorMessage(code), ok: false };
  }
  return { ok: true, value: result.data };
}

export function validateTrainerUpdate(body: unknown): TrainerUpdateValidation {
  const result = updateTrainerRequestSchema.safeParse(body);
  if (!result.success) {
    const [issue] = result.error.issues;
    const code = issue === undefined ? 'invalid_name' : readIssueCode(issue);
    return { code, message: readTrainerErrorMessage(code), ok: false };
  }
  return { ok: true, value: result.data };
}

export function readTrainerErrorMessage(code: TrainerErrorCode): string {
  return ERROR_MESSAGES[code];
}

export function normalizeTrainerName(name: string): string {
  return name.normalize('NFD').replaceAll(DIACRITICS_PATTERN, '').toLowerCase();
}

function hasEditableField(value: { gender?: Gender; name?: string }): boolean {
  return value.name !== undefined || value.gender !== undefined;
}

function readIssueCode(issue: z.ZodIssue): TrainerErrorCode {
  const [field] = issue.path;
  if (typeof field !== 'string') {
    return 'invalid_name';
  }
  return FIELD_ERROR_CODES[field] ?? 'invalid_name';
}
