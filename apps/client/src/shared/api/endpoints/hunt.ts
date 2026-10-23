import type { HuntArea, HuntAreaDetail } from '@creatures/contracts/hunt';

import type { ApiDeps } from '~/shared/api/client';
import { buildHeaders, isSuccessStatus, resolveErrorCode } from '~/shared/api/http';
import type { TrainerClientErrorCode } from '~/shared/api/http';

import { readHuntAreaDetail, readHuntAreas } from './huntAreaPayload';

const HUNT_AREAS_PATH = '/api/hunt-areas';
const UNAUTHENTICATED: TrainerClientErrorCode = 'unauthenticated';

export type HuntAreaListResult =
  | { ok: true; areas: HuntArea[] }
  | { ok: false; code: TrainerClientErrorCode };

export type HuntAreaDetailResult =
  | { ok: true; area: HuntAreaDetail }
  | { ok: false; code: TrainerClientErrorCode };

type HuntAreaFailure = { code: TrainerClientErrorCode; ok: false };

/**
 * The list of hunt areas.
 *
 * The order is the server's decision: the areas come from the lowest
 * recommended level to the highest, and the client does not reorder them.
 */
export function requestHuntAreaList(deps: ApiDeps): Promise<HuntAreaListResult> {
  return deps.getAccessToken().then(buildHuntAreaListRequester(deps));
}

/**
 * One hunt area, with every creature and every item of the place.
 */
export function requestHuntArea(deps: ApiDeps, areaId: string): Promise<HuntAreaDetailResult> {
  return deps.getAccessToken().then(buildHuntAreaRequester(deps, areaId));
}

function buildHuntAreaListRequester(
  deps: ApiDeps,
): (token: string | null) => Promise<HuntAreaListResult> {
  return function listAreasWithToken(token: string | null): Promise<HuntAreaListResult> {
    if (token === null) {
      return Promise.resolve({ code: UNAUTHENTICATED, ok: false });
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'GET' };
    return globalThis
      .fetch(buildHuntAreasUrl(deps.baseUrl), init)
      .then(readHuntAreaListResponse)
      .catch(readHuntAreaListNetworkFailure);
  };
}

function buildHuntAreaRequester(
  deps: ApiDeps,
  areaId: string,
): (token: string | null) => Promise<HuntAreaDetailResult> {
  return function readAreaWithToken(token: string | null): Promise<HuntAreaDetailResult> {
    if (token === null) {
      return Promise.resolve({ code: UNAUTHENTICATED, ok: false });
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'GET' };
    return globalThis
      .fetch(buildHuntAreaUrl(deps.baseUrl, areaId), init)
      .then(readHuntAreaDetailResponse)
      .catch(readHuntAreaDetailNetworkFailure);
  };
}

function readHuntAreaListResponse(response: Response): Promise<HuntAreaListResult> {
  return response
    .json()
    .then(buildHuntAreaListResult(response.status), buildUnreadableResult(response.status));
}

function readHuntAreaDetailResponse(response: Response): Promise<HuntAreaDetailResult> {
  return response
    .json()
    .then(buildHuntAreaDetailResult(response.status), buildUnreadableResult(response.status));
}

function buildHuntAreaListResult(status: number): (body: unknown) => HuntAreaListResult {
  return function toHuntAreaListResult(body: unknown): HuntAreaListResult {
    if (!isSuccessStatus(status)) {
      return { code: resolveErrorCode(status, body), ok: false };
    }
    return { areas: readHuntAreas(body), ok: true };
  };
}

function buildUnreadableResult(status: number): () => HuntAreaFailure {
  return function toUnreadableResult(): HuntAreaFailure {
    return { code: resolveErrorCode(status, null), ok: false };
  };
}

function buildHuntAreaDetailResult(status: number): (body: unknown) => HuntAreaDetailResult {
  return function toHuntAreaDetailResult(body: unknown): HuntAreaDetailResult {
    if (!isSuccessStatus(status)) {
      return { code: resolveErrorCode(status, body), ok: false };
    }
    const area = readHuntAreaDetail(body);
    if (area === null) {
      return { code: 'unknown', ok: false };
    }
    return { area, ok: true };
  };
}

function readHuntAreaListNetworkFailure(): HuntAreaListResult {
  return { code: 'unknown', ok: false };
}

function readHuntAreaDetailNetworkFailure(): HuntAreaDetailResult {
  return { code: 'unknown', ok: false };
}

function buildHuntAreasUrl(baseUrl: string): string {
  return `${baseUrl}${HUNT_AREAS_PATH}`;
}

function buildHuntAreaUrl(baseUrl: string, areaId: string): string {
  return `${baseUrl}${HUNT_AREAS_PATH}/${areaId}`;
}
