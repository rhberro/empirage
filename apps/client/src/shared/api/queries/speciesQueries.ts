import type { Species } from '@creatures/contracts/species';
import type { UseQueryOptions } from '@tanstack/react-query';

import type { ApiDeps } from '~/shared/api/client';
import type { SpeciesResult } from '~/shared/api/endpoints/species';
import { requestSpecies } from '~/shared/api/endpoints/species';
import { ApiRequestError } from '~/shared/api/http';

/**
 * The key of the species of a creature.
 */
export const SPECIES_QUERY_KEY = 'species' as const;

export type SpeciesQueryOptions = UseQueryOptions<
  Species,
  Error,
  Species,
  readonly ['species', string]
>;

/**
 * The species of a creature, with the abilities it declares.
 *
 * O conteudo da especie muda com o deploy, e nao com a sessao: a lista e lida
 * uma vez e fica ate a aplicacao ser recarregada.
 */
export function speciesQueryOptions(deps: ApiDeps, speciesId: string): SpeciesQueryOptions {
  return {
    queryFn: fetchSpecies(deps, speciesId),
    queryKey: [SPECIES_QUERY_KEY, speciesId] as const,
    staleTime: Infinity,
  };
}

function fetchSpecies(deps: ApiDeps, speciesId: string): () => Promise<Species> {
  return function readSpecies(): Promise<Species> {
    return requestSpecies(deps, speciesId).then(readResult);
  };
}

function readResult(result: SpeciesResult): Species {
  if (!result.ok) {
    throw new ApiRequestError(result.code);
  }
  return result.species;
}
