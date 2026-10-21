import type { StarterSpecies } from '@creatures/contracts/species';
import type { UseQueryOptions } from '@tanstack/react-query';

import type { ApiDeps } from '~/shared/api/client';
import type { StarterListResult } from '~/shared/api/endpoints/starter';
import { requestStarterList } from '~/shared/api/endpoints/starter';
import { ApiRequestError } from '~/shared/api/http';

/**
 * The key of the list of the starter species.
 */
export const STARTERS_QUERY_KEY = ['starters'] as const;

export type StartersQueryOptions = UseQueryOptions<
  StarterSpecies[],
  Error,
  StarterSpecies[],
  typeof STARTERS_QUERY_KEY
>;

/**
 * The species a trainer can start with.
 *
 * The content changes with a deploy, not with the session: the list is read
 * once and stays until the application is reloaded.
 */
export function startersQueryOptions(deps: ApiDeps): StartersQueryOptions {
  return {
    queryFn: fetchStarters(deps),
    queryKey: STARTERS_QUERY_KEY,
    staleTime: Infinity,
  };
}

function fetchStarters(deps: ApiDeps): () => Promise<StarterSpecies[]> {
  return function fetchStarterList(): Promise<StarterSpecies[]> {
    return requestStarterList(deps).then(readStarters);
  };
}

function readStarters(result: StarterListResult): StarterSpecies[] {
  if (!result.ok) {
    throw new ApiRequestError(result.code);
  }
  return result.starters;
}
