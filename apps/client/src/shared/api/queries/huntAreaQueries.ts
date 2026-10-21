import type { HuntArea, HuntAreaDetail } from '@creatures/contracts/hunt';
import type { UseQueryOptions } from '@tanstack/react-query';

import type { ApiDeps } from '~/shared/api/client';
import type { HuntAreaDetailResult, HuntAreaListResult } from '~/shared/api/endpoints/hunt';
import { requestHuntArea, requestHuntAreaList } from '~/shared/api/endpoints/hunt';
import { ApiRequestError } from '~/shared/api/http';

/**
 * The key of the list of the hunt areas.
 */
export const HUNT_AREAS_QUERY_KEY = ['hunt-areas'] as const;

export type HuntAreaListQueryOptions = UseQueryOptions<
  HuntArea[],
  Error,
  HuntArea[],
  typeof HUNT_AREAS_QUERY_KEY
>;

/**
 * The key of one hunt area.
 */
export function huntAreaQueryKey(areaId: string): readonly ['hunt-area', string] {
  return ['hunt-area', areaId];
}

export type HuntAreaQueryOptions = UseQueryOptions<
  HuntAreaDetail,
  Error,
  HuntAreaDetail,
  readonly ['hunt-area', string]
>;

/**
 * The list of the hunt areas.
 *
 * The content changes with a deploy, not with the session.
 */
export function huntAreaListQueryOptions(deps: ApiDeps): HuntAreaListQueryOptions {
  return {
    queryFn: fetchHuntAreas(deps),
    queryKey: HUNT_AREAS_QUERY_KEY,
    staleTime: Infinity,
  };
}

/**
 * One hunt area, with every creature and every item of the place.
 *
 * The content changes with a deploy, not with the session.
 */
export function huntAreaQueryOptions(deps: ApiDeps, areaId: string): HuntAreaQueryOptions {
  return {
    queryFn: fetchHuntArea(deps, areaId),
    queryKey: huntAreaQueryKey(areaId),
    staleTime: Infinity,
  };
}

function fetchHuntAreas(deps: ApiDeps): () => Promise<HuntArea[]> {
  return function fetchHuntAreaList(): Promise<HuntArea[]> {
    return requestHuntAreaList(deps).then(readHuntAreas);
  };
}

function fetchHuntArea(deps: ApiDeps, areaId: string): () => Promise<HuntAreaDetail> {
  return function fetchOneHuntArea(): Promise<HuntAreaDetail> {
    return requestHuntArea(deps, areaId).then(readHuntArea);
  };
}

function readHuntAreas(result: HuntAreaListResult): HuntArea[] {
  if (!result.ok) {
    throw new ApiRequestError(result.code);
  }
  return result.areas;
}

function readHuntArea(result: HuntAreaDetailResult): HuntAreaDetail {
  if (!result.ok) {
    throw new ApiRequestError(result.code);
  }
  return result.area;
}
