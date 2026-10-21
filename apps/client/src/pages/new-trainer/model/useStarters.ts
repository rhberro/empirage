import type { StarterSpecies } from '@creatures/contracts/species';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { ApiDeps, TrainerClientErrorCode } from '~/shared/api';
import { createApiDeps, readErrorCode, startersQueryOptions } from '~/shared/api';
import { getAccessToken, useAuth } from '~/shared/auth';

const AUTHENTICATED_STATUS = 'AUTHENTICATED';

export type StartersHook = {
  error: TrainerClientErrorCode | null;
  isLoading: boolean;
  refresh(): Promise<void>;
  starters: StarterSpecies[];
};

/**
 * The species a trainer can start with.
 *
 * The list is content: it changes with a deploy and not with the session, so
 * the cache of the query keeps it and the screen that opens later does not
 * ask the server again.
 */
export function useStarters(): StartersHook {
  const auth = useAuth();
  const isAuthenticated = auth.status === AUTHENTICATED_STATUS;
  const deps = useMemo(buildDeps, []);
  const query = useQuery({ ...startersQueryOptions(deps), enabled: isAuthenticated });

  return {
    error: query.isError ? readErrorCode(query.error) : null,
    isLoading: isAuthenticated && query.isPending,
    refresh: buildRefresh(query.refetch),
    starters: query.data ?? [],
  };
}

function buildDeps(): ApiDeps {
  return createApiDeps(getAccessToken);
}

function buildRefresh(refetch: () => Promise<unknown>): () => Promise<void> {
  return function refresh(): Promise<void> {
    return refetch().then(ignoreAnswer);
  };
}

function ignoreAnswer(): void {
  void 0;
}
