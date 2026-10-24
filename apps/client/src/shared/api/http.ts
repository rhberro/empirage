import type { RateLimitErrorCode } from '@creatures/contracts/rateLimit';
import type { TrainerErrorCode } from '@creatures/contracts/trainer';

const MIN_SUCCESS_STATUS = 200;
const MAX_SUCCESS_STATUS = 300;
const UNAUTHORIZED_STATUS = 401;
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const TOO_MANY_REQUESTS_STATUS = 429;

const UNAUTHENTICATED: TrainerErrorCode = 'unauthenticated';
const INVALID_INPUT: TrainerErrorCode = 'invalid_name';
const TRAINER_NOT_FOUND: TrainerErrorCode = 'trainer_not_found';
const NAME_TAKEN: TrainerErrorCode = 'name_taken';
const MAX_TRAINERS_REACHED: TrainerErrorCode = 'max_trainers_reached';
const STARTER_UNAVAILABLE: TrainerErrorCode = 'starter_unavailable';

/**
 * Every code the API can answer with.
 *
 * The map is exhaustive by construction: adding a code to the contract without
 * adding it here breaks the build.
 */
const TRAINER_ERROR_CODES: Record<TrainerErrorCode, true> = {
  creature_not_found: true,
  invalid_gender: true,
  invalid_name: true,
  invalid_starter: true,
  invalid_team_command: true,
  invalid_trainer: true,
  last_creature: true,
  last_team_member: true,
  max_trainers_reached: true,
  name_taken: true,
  starter_unavailable: true,
  swap_cooldown: true,
  team_full: true,
  trainer_not_found: true,
  unauthenticated: true,
};

/**
 * The codes of the rate limit.
 *
 * The rate limit is not a trainer rule, so it has its own namespace in the
 * contract. The two meet in the client, which shows one message for both.
 */
const RATE_LIMIT_ERROR_CODES: Record<RateLimitErrorCode, true> = {
  rate_limited: true,
};

/**
 * The codes each status can carry.
 *
 * The status alone does not say which rule broke: a 409 is the name taken or
 * the trainer limit, and a 400 is an invalid field or a starter that is not
 * available anymore. The body says which one it is.
 */
const STATUS_CODES: Record<number, readonly (TrainerErrorCode | RateLimitErrorCode)[]> = {
  [BAD_REQUEST_STATUS]: [
    'invalid_name',
    'invalid_gender',
    'invalid_starter',
    'invalid_trainer',
    'invalid_team_command',
    STARTER_UNAVAILABLE,
  ],
  [CONFLICT_STATUS]: [
    MAX_TRAINERS_REACHED,
    NAME_TAKEN,
    'last_creature',
    'last_team_member',
    'team_full',
  ],
  [NOT_FOUND_STATUS]: [TRAINER_NOT_FOUND, 'creature_not_found'],
  [TOO_MANY_REQUESTS_STATUS]: ['rate_limited', 'swap_cooldown'],
  [UNAUTHORIZED_STATUS]: [UNAUTHENTICATED],
};

const STATUS_FALLBACK: Record<number, TrainerErrorCode | RateLimitErrorCode> = {
  [BAD_REQUEST_STATUS]: INVALID_INPUT,
  [CONFLICT_STATUS]: NAME_TAKEN,
  [NOT_FOUND_STATUS]: TRAINER_NOT_FOUND,
  [TOO_MANY_REQUESTS_STATUS]: 'rate_limited',
  [UNAUTHORIZED_STATUS]: UNAUTHENTICATED,
};

export type TrainerClientErrorCode = TrainerErrorCode | RateLimitErrorCode | 'unknown';

/**
 * The failure of a request that the server answered with a refusal.
 *
 * The code is what the server named. The query layer throws it so that the
 * failure becomes an error of the query, and not a value the screen has to
 * remember to check.
 */
export class ApiRequestError extends Error {
  public readonly code: string;

  public constructor(code: string) {
    super(code);
    this.name = 'ApiRequestError';
    this.code = code;
  }
}

/**
 * The code of a failed request, for the screen that shows it.
 *
 * A code the client does not know becomes `unknown`: the screen has a message
 * for it, and the failure is still a failure.
 */
export function readErrorCode(error: unknown): TrainerClientErrorCode {
  if (error instanceof ApiRequestError && isKnownErrorCode(error.code)) {
    return error.code;
  }
  return 'unknown';
}

/**
 * Only a request that got no answer deserves another attempt.
 *
 * Every code the server names is a decision: repeating the request would
 * repeat the same refusal.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return error.code === 'unknown';
  }
  return true;
}

export function buildHeaders(token: string): Headers {
  const headers = new globalThis.Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return headers;
}

export function isSuccessStatus(status: number): boolean {
  return status >= MIN_SUCCESS_STATUS && status < MAX_SUCCESS_STATUS;
}

/**
 * The code of a failed answer.
 *
 * The body comes first, because it names the rule that broke. The status is
 * the fallback for the answers that carry no code.
 */
export function resolveErrorCode(status: number, body: unknown): TrainerClientErrorCode {
  const bodyCode = readBodyErrorCode(status, body);
  if (bodyCode !== null) {
    return bodyCode;
  }
  return STATUS_FALLBACK[status] ?? 'unknown';
}

export function isKnownErrorCode(value: unknown): value is TrainerErrorCode | RateLimitErrorCode {
  if (typeof value !== 'string') {
    return false;
  }
  return Object.hasOwn(TRAINER_ERROR_CODES, value) || Object.hasOwn(RATE_LIMIT_ERROR_CODES, value);
}

function readBodyErrorCode(
  status: number,
  body: unknown,
): TrainerErrorCode | RateLimitErrorCode | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const error = (body as { error?: unknown }).error;
  if (!isKnownErrorCode(error)) {
    return null;
  }
  const allowed = STATUS_CODES[status];
  if (allowed === undefined) {
    return error;
  }
  return allowed.includes(error) ? error : null;
}
