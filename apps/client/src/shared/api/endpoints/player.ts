import type { PlayerState } from '@creatures/contracts/player';

import type { ApiDeps } from '~/shared/api/client';
import { buildHeaders, isSuccessStatus, resolveErrorCode } from '~/shared/api/http';
import type { TrainerClientErrorCode } from '~/shared/api/http';

const PLAYER_STATE_PATH = '/api/player/state';
const SESSION_TRAINER_PATH = '/api/session/trainer';
const NO_CONTENT_STATUS = 204;
const UNAUTHENTICATED: TrainerClientErrorCode = 'unauthenticated';

/**
 * The answer of a read of the state of the player.
 *
 * Without a revision, the server answers with the whole state: the state is
 * never empty.
 */
export type PlayerStateResult =
  | { ok: true; state: PlayerState }
  | { ok: false; code: TrainerClientErrorCode };

/**
 * The answer of a read that asks for a revision.
 *
 * A state that is `null` is not a failure: it is the answer of a server that
 * has nothing newer than the revision that was asked for.
 */
export type PlayerStateRevisionResult =
  | { ok: true; state: PlayerState | null }
  | { ok: false; code: TrainerClientErrorCode };

export type SessionTrainerResult = { ok: true } | { ok: false; code: TrainerClientErrorCode };

/**
 * The state of the player.
 *
 * With a revision, the server answers with the state only when it is newer
 * than it: the answer of `204` says that there is nothing new, and it is not
 * a failure.
 */
export function requestPlayerState(deps: ApiDeps): Promise<PlayerStateResult>;
export function requestPlayerState(
  deps: ApiDeps,
  sinceRev: number | undefined,
): Promise<PlayerStateRevisionResult>;
export function requestPlayerState(
  deps: ApiDeps,
  sinceRev?: number,
): Promise<PlayerStateRevisionResult> {
  return deps.getAccessToken().then(buildPlayerStateRequester(deps, sinceRev));
}

export function requestSessionTrainer(
  deps: ApiDeps,
  trainerId: string,
): Promise<SessionTrainerResult> {
  return deps.getAccessToken().then(buildSessionTrainerRequester(deps, trainerId));
}

function buildPlayerStateRequester(
  deps: ApiDeps,
  sinceRev: number | undefined,
): (token: string | null) => Promise<PlayerStateRevisionResult> {
  return function readStateWithToken(token: string | null): Promise<PlayerStateRevisionResult> {
    if (token === null) {
      return Promise.resolve({ code: UNAUTHENTICATED, ok: false });
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'GET' };
    return globalThis
      .fetch(buildPlayerStateUrl(deps.baseUrl, sinceRev), init)
      .then(readPlayerStateResponse)
      .catch(readPlayerStateNetworkFailure);
  };
}

function buildSessionTrainerRequester(
  deps: ApiDeps,
  trainerId: string,
): (token: string | null) => Promise<SessionTrainerResult> {
  return function openSessionWithToken(token: string | null): Promise<SessionTrainerResult> {
    if (token === null) {
      return Promise.resolve({ code: UNAUTHENTICATED, ok: false });
    }
    const headers = buildHeaders(token);
    const body = JSON.stringify({ trainerId });
    const init = { body, headers, method: 'POST' };
    return globalThis
      .fetch(buildSessionTrainerUrl(deps.baseUrl), init)
      .then(readSessionTrainerResponse)
      .catch(readSessionTrainerNetworkFailure);
  };
}

function readPlayerStateResponse(response: Response): Promise<PlayerStateRevisionResult> {
  if (response.status === NO_CONTENT_STATUS) {
    return Promise.resolve({ ok: true, state: null });
  }
  return response
    .json()
    .then(
      buildPlayerStateResult(response.status),
      buildUnreadablePlayerStateResult(response.status),
    );
}

function readSessionTrainerResponse(response: Response): Promise<SessionTrainerResult> {
  if (isSuccessStatus(response.status)) {
    return Promise.resolve({ ok: true });
  }
  return response
    .json()
    .then(
      buildSessionTrainerResult(response.status),
      buildUnreadableSessionTrainerResult(response.status),
    );
}

function buildPlayerStateResult(status: number): (body: unknown) => PlayerStateRevisionResult {
  return function toPlayerStateResult(body: unknown): PlayerStateRevisionResult {
    if (!isSuccessStatus(status)) {
      return { code: resolveErrorCode(status, body), ok: false };
    }
    const state = readPlayerState(body);
    return state === null ? { code: 'unknown', ok: false } : { ok: true, state };
  };
}
function buildUnreadablePlayerStateResult(status: number): () => PlayerStateRevisionResult {
  return function toUnreadablePlayerStateResult(): PlayerStateRevisionResult {
    return { code: resolveErrorCode(status, null), ok: false };
  };
}

function buildSessionTrainerResult(status: number): (body: unknown) => SessionTrainerResult {
  return function toSessionTrainerResult(body: unknown): SessionTrainerResult {
    return { code: resolveErrorCode(status, body), ok: false };
  };
}

function buildUnreadableSessionTrainerResult(status: number): () => SessionTrainerResult {
  return function toUnreadableSessionTrainerResult(): SessionTrainerResult {
    return { code: resolveErrorCode(status, null), ok: false };
  };
}

function readPlayerStateNetworkFailure(): PlayerStateRevisionResult {
  return { code: 'unknown', ok: false };
}

function readSessionTrainerNetworkFailure(): SessionTrainerResult {
  return { code: 'unknown', ok: false };
}

/**
 * The shape of a state the client accepts.
 *
 * The revision, the epoch and the clock of the server are what decide if the
 * state is applied: a state without them is a state the client cannot order,
 * and it is refused.
 */
function readPlayerState(body: unknown): PlayerState | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const state = body as Partial<PlayerState>;
  if (typeof state.trainer !== 'object' || state.trainer === null) {
    return null;
  }
  if (!Array.isArray(state.team)) {
    return null;
  }
  if (
    typeof state.gold !== 'number' ||
    typeof state.diamonds !== 'number' ||
    typeof state.staminaMinutes !== 'number' ||
    typeof state.maxStaminaMinutes !== 'number'
  ) {
    return null;
  }
  if (
    typeof state.rev !== 'number' ||
    typeof state.epoch !== 'string' ||
    typeof state.serverNow !== 'number'
  ) {
    return null;
  }
  return body as PlayerState;
}

function buildPlayerStateUrl(baseUrl: string, sinceRev: number | undefined): string {
  const url = `${baseUrl}${PLAYER_STATE_PATH}`;
  if (sinceRev === undefined) {
    return url;
  }
  return `${url}?sinceRev=${sinceRev}`;
}

function buildSessionTrainerUrl(baseUrl: string): string {
  return `${baseUrl}${SESSION_TRAINER_PATH}`;
}
