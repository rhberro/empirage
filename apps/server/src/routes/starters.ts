import { listStarterSpecies } from '~/db/speciesRepository';
import type { ServerDependencies } from '~/dependencies';
import { protectRoute } from '~/ratelimit/protectedRoute';
import { limitPublicRoute } from '~/ratelimit/publicLimiter';
import { defineRoute, jsonResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';

const STARTERS_PATH = '/api/starters';
const OK = 200;

export function createStarterRoutes(deps: ServerDependencies): Route[] {
  /**
   * The list of the species of the starter is public content.
   *
   * Asking for a token only costs the client a session it already has, and
   * it keeps the answer of the route out of the cache of everybody. The route
   * keeps the limit of attempts, counted by the address of the request, since
   * there is no account to count.
   */
  const handler = limitPublicRoute(
    deps.publicLimiter,
    protectRoute(deps, handleListStarters(deps)),
  );
  return [defineRoute('GET', STARTERS_PATH, handler)];
}

function handleListStarters(deps: ServerDependencies): RouteHandler {
  return function listStarters(
    _req: Request,
    _params: Record<string, string>,
    _ctx: RequestContext,
  ): Promise<Response> {
    return listStarterSpecies(deps.admin).then(function toBody(starters: unknown[]): Response {
      return jsonResponse({ starters }, OK);
    });
  };
}
