import type { HuntAreaDetail } from '@creatures/contracts/hunt';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { HuntAreaStatus } from '~/features/hunt-area/model/useHuntAreaList';
import type { ApiDeps } from '~/shared/api';
import { createApiDeps, huntAreaQueryOptions } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

export type HuntAreaDetailState = {
  area: HuntAreaDetail | null;
  error: string | null;
  status: HuntAreaStatus;
};

const LOAD_ERROR = 'Não foi possível carregar os detalhes do local.';

/**
 * The details of one hunt area.
 *
 * The drawer asks for the area when the player selects it, and forgets it when
 * the selection ends. The content is the same for the whole session, so the
 * cache of the query keeps it.
 */
export function useHuntAreaDetail(areaId: string | null): HuntAreaDetailState {
  const deps = useMemo(buildDeps, []);
  const query = useQuery({
    ...huntAreaQueryOptions(deps, areaId ?? NO_AREA),
    enabled: areaId !== null,
  });
  const status = readStatus(query.isPending, query.isError);

  return {
    area: areaId === null ? null : (query.data ?? null),
    error: status === 'error' ? LOAD_ERROR : null,
    status,
  };
}

const NO_AREA = '';

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
