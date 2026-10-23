import { findSpeciesById } from '~/db/speciesRepository';
import type { ServerDependencies } from '~/dependencies';
import { defineRoute, errorResponse, jsonResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { composeProtectedRoute } from '~/routes/routeChain';

const SPECIES_PATH = '/api/species/:speciesId';
const OK = 200;
const NOT_FOUND = 404;

export function createSpeciesRoutes(deps: ServerDependencies): Route[] {
  return [defineRoute('GET', SPECIES_PATH, composeProtectedRoute(deps, handleSpecies(deps)))];
}

/**
 * The species of a creature, with the abilities it declares.
 *
 * A criatura carrega os valores de base da especie, mas nao as habilidades: o
 * detalhe de uma criatura que esta no armazenamento precisa das habilidades da
 * especie, e e isso que a rota responde.
 */
function handleSpecies(deps: ServerDependencies): RouteHandler {
  return function readSpecies(
    _req: Request,
    params: Record<string, string>,
    _ctx: RequestContext,
  ): Promise<Response> {
    const speciesId = params.speciesId;
    if (speciesId === undefined) {
      return Promise.resolve(notFoundResponse());
    }
    return findSpeciesById(deps.admin, speciesId).then(function toResponse(
      species: unknown | null,
    ): Response {
      if (species === null) {
        return notFoundResponse();
      }
      return jsonResponse({ species }, OK);
    });
  };
}

function notFoundResponse(): Response {
  return errorResponse(NOT_FOUND, 'species_not_found', 'Espécie não encontrada.');
}
