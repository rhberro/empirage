/* eslint-disable oxsome/no-inline-structural-types */
import { type UseQueryResult, queryOptions, useQuery } from '@tanstack/react-query';

import { getHuntingLocations, type HuntingLocation } from '~/entities/hunting-location';
import { selectAuthSession, useAuthStore } from '~/shared/auth';

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
