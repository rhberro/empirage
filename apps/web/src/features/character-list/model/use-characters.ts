import { type UseQueryResult, queryOptions, useQuery } from '@tanstack/react-query';

import { selectAuthSession, useAuthStore } from '~/shared/auth';

import { getCharacters, type Characters } from '../api/get-characters';

export function useCharacters(): UseQueryResult<Characters, Error> {
  const session = useAuthStore(selectAuthSession);
  const userId = session ? session.user.id : null;
  const queryOptionsParameters = {
    enabled: Boolean(userId),
    queryFn: getCharacters,
    queryKey: ['characters', userId],
  };
  const options = queryOptions(queryOptionsParameters);
  return useQuery(options);
}
