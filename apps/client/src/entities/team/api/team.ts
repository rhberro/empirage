import { isTeamErrorCode } from '~/entities/team/model/team.errors';
import type { TeamCommandResult, TeamErrorCode } from '~/entities/team/model/team.types';
import type { ApiDeps } from '~/shared/api';
import { buildHeaders, isSuccessStatus, resolveErrorCode } from '~/shared/api';
import type { TrainerClientErrorCode } from '~/shared/api';

const TEAM_PATH = '/api/team';
const CREATURE_PATH = '/api/creatures';
const UNAUTHENTICATED: TeamErrorCode = 'unauthenticated';

export function requestAddToTeam(deps: ApiDeps, creatureId: string): Promise<TeamCommandResult> {
  return requestTeamCommand(
    deps,
    buildTeamUrl(deps.baseUrl),
    buildBodyInit('POST', { creatureId }),
  );
}

export function requestRemoveFromTeam(
  deps: ApiDeps,
  creatureId: string,
): Promise<TeamCommandResult> {
  return requestTeamCommand(deps, buildTeamMemberUrl(deps.baseUrl, creatureId), {
    method: 'DELETE',
  });
}

export function requestReorderTeam(deps: ApiDeps, order: string[]): Promise<TeamCommandResult> {
  return requestTeamCommand(deps, buildTeamUrl(deps.baseUrl), buildBodyInit('PUT', { order }));
}

/**
 * The release of a creature: it leaves the storage of the trainer for good.
 */
export function requestReleaseCreature(
  deps: ApiDeps,
  creatureId: string,
): Promise<TeamCommandResult> {
  return requestTeamCommand(deps, buildCreatureUrl(deps.baseUrl, creatureId), {
    method: 'DELETE',
  });
}

function buildBodyInit(method: 'POST' | 'PUT', body: Record<string, unknown>): RequestInit {
  return { body: JSON.stringify(body), method };
}

function buildTeamUrl(baseUrl: string): string {
  return `${baseUrl}${TEAM_PATH}`;
}

function buildTeamMemberUrl(baseUrl: string, creatureId: string): string {
  return `${baseUrl}${TEAM_PATH}/${creatureId}`;
}

function buildCreatureUrl(baseUrl: string, creatureId: string): string {
  return `${baseUrl}${CREATURE_PATH}/${creatureId}`;
}

/**
 * The team command: the transport is the same one the rest of the client uses,
 * so the headers, the status reading and the error codes do not branch here.
 */
function requestTeamCommand(
  deps: ApiDeps,
  url: string,
  init: RequestInit,
): Promise<TeamCommandResult> {
  return deps.getAccessToken().then(function withToken(
    token: string | null,
  ): TeamCommandResult | Promise<TeamCommandResult> {
    if (token === null) {
      return { code: UNAUTHENTICATED, ok: false };
    }
    const headers = buildHeaders(token);
    return globalThis.fetch(url, { ...init, headers }).then(readTeamResponse, readTeamFailure);
  });
}

function readTeamResponse(response: Response): Promise<TeamCommandResult> {
  if (isSuccessStatus(response.status)) {
    return Promise.resolve({ ok: true });
  }
  return response
    .json()
    .then(buildTeamResult(response.status), buildUnreadableTeamResult(response.status));
}

function buildTeamResult(status: number): (body: unknown) => TeamCommandResult {
  return function toTeamResult(body: unknown): TeamCommandResult {
    return { code: readTeamErrorCode(resolveErrorCode(status, body)), ok: false };
  };
}

function buildUnreadableTeamResult(status: number): () => TeamCommandResult {
  return function toUnreadableTeamResult(): TeamCommandResult {
    return { code: readTeamErrorCode(resolveErrorCode(status, null)), ok: false };
  };
}

function readTeamFailure(): TeamCommandResult {
  return { code: 'unknown', ok: false };
}

/**
 * The team endpoints answer with the trainer error namespace, but a team
 * command only ever answers with its own codes. A code from outside is an
 * unknown failure, not a team rule.
 */
function readTeamErrorCode(code: TrainerClientErrorCode): TeamErrorCode {
  return isTeamErrorCode(code) ? code : 'unknown';
}
