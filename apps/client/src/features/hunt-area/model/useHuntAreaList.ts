import type { HuntArea } from '@creatures/contracts/hunt';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { ApiDeps } from '~/shared/api';
import { createApiDeps, huntAreaListQueryOptions } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

export type HuntAreaStatus = 'error' | 'loading' | 'ready';

export type HuntAreaListState = {
  areas: HuntArea[];
  error: string | null;
  reload: () => void;
  status: HuntAreaStatus;
};

const LOAD_ERROR = 'Não foi possível carregar os locais de caça.';

/**
 * The list of hunt areas.
 *
 * The list is content: it changes with a deploy and not with the session, so
 * the cache of the query keeps it and opening the modal again does not ask
 * the server for it.
 */
export function useHuntAreaList(isOpen: boolean): HuntAreaListState {
  const deps = useMemo(buildDeps, []);
  const query = useQuery({ ...huntAreaListQueryOptions(deps), enabled: isOpen });
  const status = readStatus(query.isPending, query.isError);

  return {
    areas: query.data ?? [],
    error: status === 'error' ? LOAD_ERROR : null,
    reload: buildReload(query.refetch),
    status,
  };
}

function buildDeps(): ApiDeps {
  return createApiDeps(getAccessToken);
}

function readStatus(isPending: boolean, isError: boolean): HuntAreaStatus {
  if (isError) {
    return 'error';
  }
  if (isPending) {
    return 'loading';
  }
  return 'ready';
}

function buildReload(refetch: () => Promise<unknown>): () => void {
  return function reload(): void {
    void refetch();
  };
}
