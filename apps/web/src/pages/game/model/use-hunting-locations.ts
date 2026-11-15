/* eslint-disable oxsome/no-inline-structural-types */
import { type UseQueryResult, queryOptions, useQuery } from '@tanstack/react-query';

import { selectAuthSession, useAuthStore } from '~/shared/auth';

import { getHuntingLocations, type HuntingLocation } from '../api/hunting-locations';

export function useHuntingLocations(): UseQueryResult<Array<HuntingLocation>, Error> {
  const session = useAuthStore(selectAuthSession);
  const userId = session ? session.user.id : null;
  const parameters = {
    enabled: Boolean(userId),
    queryFn: getHuntingLocations,
    queryKey: ['hunting-locations'],
  };
  const options = queryOptions(parameters);
  return useQuery(options);
}
