import { destroyBackpackItem } from '~/db/backpackRepository';
import type { DestroyItemOutcome } from '~/db/backpackRepository';
import type { ServerDependencies } from '~/dependencies';
import { logRouteEvent } from '~/logging/routeLog';
import { defineRoute, errorResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { claimDestroyItemKey } from '~/routes/backpackIdempotency';
import { readJsonBody, readSessionTrainer, unauthenticatedResponse } from '~/routes/loadoutSupport';
import { composeProtectedRoute } from '~/routes/routeChain';
import { readIdempotencyKey, releaseKey } from '~/routes/storeIdempotency';
import { readDestroyItemErrorMessage, validateDestroyItemCommand } from '~/validation/inventory';
import type { DestroyItemValidation } from '~/validation/inventory';

const DESTROY_ITEM_PATH = '/api/backpack/destroy';
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const INTERNAL_ERROR = 500;

export function createBackpackRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute('POST', DESTROY_ITEM_PATH, composeProtectedRoute(deps, handleDestroyItem(deps))),
  ];
}

/**
 * Destroys one unit of an item of the backpack.
 *
 * The command answers with no content and pushes the new state to the channel
 * of the account: the backpack of the player changed, and the screen has to
 * know.
 *
 * The result is kept when the request carries a key: a retried request must not
 * destroy a second unit.
 */
function handleDestroyItem(deps: ServerDependencies): RouteHandler {
  return function destroyItem(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const key = readIdempotencyKey(req);
    const claimed = claimDestroyItemKey(deps, userId, key);
    if (claimed !== null) {
      return Promise.resolve(claimed);
    }
    const trainerId = readSessionTrainer(deps, userId);
    if (typeof trainerId !== 'string') {
      releaseKey(deps, userId, key);
      return Promise.resolve(trainerId);
    }
    return readJsonBody(req)
      .then(validateDestroyItemCommand)
      .then(function withCommand(validation: DestroyItemValidation): Response | Promise<Response> {
        if (!validation.ok) {
          releaseKey(deps, userId, key);
          return errorResponse(BAD_REQUEST, validation.code, validation.message);
        }
        return destroyBackpackItem(deps.admin, trainerId, validation.value.itemId).then(
          function afterDestroy(outcome: DestroyItemOutcome): Response {
            return readOutcome(deps, ctx, userId, trainerId, validation.value.itemId, outcome, key);
          },
        );
      });
  };
}

function readOutcome(
  deps: ServerDependencies,
  ctx: RequestContext,
  userId: string,
  trainerId: string,
  itemId: string,
  outcome: DestroyItemOutcome,
  key: string | null,
): Response {
  if (outcome.status === 'failed') {
    // The command was refused by the database, so it was not applied: the key
    // is free and the client can send it again.
    releaseKey(deps, userId, key);
    return errorResponse(
      INTERNAL_ERROR,
      'destroy_item_internal_error',
      readDestroyItemErrorMessage('destroy_item_internal_error'),
    );
  }
  if (outcome.status === 'not_in_backpack') {
    releaseKey(deps, userId, key);
    return errorResponse(
      NOT_FOUND,
      'destroy_item_not_in_backpack',
      readDestroyItemErrorMessage('destroy_item_not_in_backpack'),
    );
  }
  if (outcome.status === 'equipped') {
    releaseKey(deps, userId, key);
    return errorResponse(
      CONFLICT,
      'destroy_item_equipped',
      readDestroyItemErrorMessage('destroy_item_equipped'),
    );
  }
  deps.broadcaster.pushState(userId, trainerId);
  logRouteEvent(deps.logger, ctx, 'backpack item destroyed', { itemId });
  if (key !== null) {
    deps.idempotency.set(userId, key, { body: null, status: NO_CONTENT });
  }
  return new globalThis.Response(null, { status: NO_CONTENT });
}
