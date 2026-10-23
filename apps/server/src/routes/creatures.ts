import { releaseCreature } from '~/db/creatureRepository';
import { mapTeamOperationError } from '~/db/errors';
import type { DatabaseError } from '~/db/types';
import type { ServerDependencies } from '~/dependencies';
import { logRouteEvent } from '~/logging/routeLog';
import { defineRoute, errorResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { composeProtectedRoute } from '~/routes/routeChain';
import { readTrainerErrorMessage } from '~/validation/trainer';

const CREATURE_PATH = '/api/creatures/:creatureId';
const NO_CONTENT = 204;
const NOT_FOUND = 404;
const UNAUTHENTICATED = 401;

export function createCreatureRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute('DELETE', CREATURE_PATH, composeProtectedRoute(deps, handleReleaseCreature(deps))),
  ];
}

/**
 * The release of a creature.
 *
 * A criatura sai do armazenamento do treinador e deixa de existir. O comando
 * empurra o novo estado da conta, porque o armazenamento do cliente mudou.
 */
function handleReleaseCreature(deps: ServerDependencies): RouteHandler {
  return function releaseCreatureRoute(
    _req: Request,
    params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = deps.sessions.get(userId);
    if (trainerId === null) {
      return Promise.resolve(notFoundResponse());
    }
    const creatureId = params.creatureId;
    if (creatureId === undefined) {
      return Promise.resolve(notFoundResponse());
    }
    return releaseCreature(deps.admin, trainerId, userId, creatureId).then(
      function readOutcome(outcome: { error: DatabaseError | null; released: boolean }): Response {
        if (outcome.error !== null) {
          const mapped = mapTeamOperationError(outcome.error);
          return errorResponse(mapped.status, mapped.code, mapped.message);
        }
        deps.broadcaster.pushState(userId, trainerId);
        logRouteEvent(deps.logger, ctx, 'creature released', { creatureId });
        const init = { status: NO_CONTENT };
        return new globalThis.Response(null, init);
      },
    );
  };
}

function unauthenticatedResponse(): Response {
  return errorResponse(
    UNAUTHENTICATED,
    'unauthenticated',
    readTrainerErrorMessage('unauthenticated'),
  );
}

function notFoundResponse(): Response {
  return errorResponse(
    NOT_FOUND,
    'trainer_not_found',
    readTrainerErrorMessage('trainer_not_found'),
  );
}
