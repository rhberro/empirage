import type { Species } from '@creatures/contracts/species';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createApiDeps, speciesQueryOptions } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

/**
 * The species of a creature, with the abilities it declares.
 *
 * A criatura carrega os valores de base da especie, mas nao as habilidades: o
 * detalhe de uma criatura do armazenamento precisa delas, e a especie e lida
 * uma vez so.
 */
export function useSpecies(speciesId: string | null): Species | null {
  const deps = useMemo(buildDeps, []);
  const query = useQuery({
    ...speciesQueryOptions(deps, speciesId ?? ''),
    enabled: speciesId !== null,
  });
  return query.data ?? null;
}

function buildDeps(): ReturnType<typeof createApiDeps> {
  return createApiDeps(getAccessToken);
}
