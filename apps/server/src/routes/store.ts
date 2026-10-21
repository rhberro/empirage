import type { StoreBagItem } from '@creatures/contracts/store';

import { mapStoreOperationError } from '~/db/storeErrors';
import {
  buyStoreItem,
  listStoreBag,
  listStoreItems,
  readTrainerGold,
  sellStoreItem,
} from '~/db/storeRepository';
import type { ServerDependencies } from '~/dependencies';
import { logRouteEvent } from '~/logging/routeLog';
import type { RouteLogFields } from '~/logging/routeLog';
import { defineRoute, errorResponse, jsonResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { readJsonBody, readSessionTrainer } from '~/routes/loadoutSupport';
import { composeProtectedRoute } from '~/routes/routeChain';
import { claimKey, readIdempotencyKey, releaseKey } from '~/routes/storeIdempotency';
import { readStoreErrorMessage, validateStoreCommand } from '~/validation/store';
import type { StoreCommand, StoreCommandValidation } from '~/validation/store';

const STORE_PATH = '/api/store';
const BUY_PATH = '/api/store/buy';
const SELL_PATH = '/api/store/sell';
const OK = 200;
const BAD_REQUEST = 400;
const UNAUTHENTICATED = 401;

export function createStoreRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute('GET', STORE_PATH, composeProtectedRoute(deps, handleReadCatalog(deps))),
    defineRoute('POST', BUY_PATH, composeProtectedRoute(deps, handleBuy(deps))),
    defineRoute('POST', SELL_PATH, composeProtectedRoute(deps, handleSell(deps))),
  ];
}

/**
 * The catalog of the store and the wallet of the trainer.
 *
 * The backpack comes with the catalog because the sell tab shows it: the
 * player sells what he owns, and the price of the sale comes from the same
 * catalog the buy shows.
 */
function handleReadCatalog(deps: ServerDependencies): RouteHandler {
  return function readCatalog(
    _req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = readSessionTrainer(deps, userId);
    if (typeof trainerId !== 'string') {
      return Promise.resolve(trainerId);
    }
    return Promise.all([
      listStoreItems(deps.admin),
      listStoreBag(deps.admin, trainerId),
      readTrainerGold(deps.admin, trainerId),
    ]).then(function withCatalog(reads: [unknown, StoreBagItem[], number | null]): Response {
      const [items, bag, gold] = reads;
      return jsonResponse({ bag, gold: gold ?? 0, items }, OK);
    });
  };
}

/**
 * Buys an item of the store.
 *
 * The purchase has no confirmation: the click is the purchase. The gold is
 * debited and the item goes to the backpack, in one transaction in the
 * database.
 */
function handleBuy(deps: ServerDependencies): RouteHandler {
  return function buy(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    return runCommand(deps, req, ctx, buyStoreItem, 'store item bought');
  };
}

/**
 * Sells a quantity of an item the trainer owns.
 *
 * The sale yields 90% of the price of the item: the difference is the cost of
 * passing through the store.
 */
function handleSell(deps: ServerDependencies): RouteHandler {
  return function sell(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    return runCommand(deps, req, ctx, sellStoreItem, 'store item sold');
  };
}

type StoreOperation = (
  admin: Parameters<typeof buyStoreItem>[0],
  input: { itemId: string; quantity: number; trainerId: string },
) => Promise<unknown>;

/**
 * The command of the store: the buy and the sale share the same shape.
 */
function runCommand(
  deps: ServerDependencies,
  req: Request,
  ctx: RequestContext,
  operation: StoreOperation,
  event: string,
): Promise<Response> {
  const userId = ctx.userId;
  if (userId === null) {
    return Promise.resolve(unauthenticatedResponse());
  }
  const key = readIdempotencyKey(req);
  const claimed = claimKey(deps, userId, key);
  if (claimed !== null) {
    return Promise.resolve(claimed);
  }
  const trainerId = readSessionTrainer(deps, userId);
  if (typeof trainerId !== 'string') {
    releaseKey(deps, userId, key);
    return Promise.resolve(trainerId);
  }
  return readCommandBody(req, deps, userId, key)
    .then(validateStoreCommand)
    .then(function withCommand(validation: StoreCommandValidation): Response | Promise<Response> {
      if (!validation.ok) {
        releaseKey(deps, userId, key);
        return errorResponse(BAD_REQUEST, validation.code, validation.message);
      }
      return runOperation(deps, operation, validation.value, trainerId).then(
        function afterOperation(outcome: unknown): Promise<Response> {
          return readOutcome(
            deps,
            ctx,
            userId,
            trainerId,
            outcome,
            event,
            {
              itemId: validation.value.itemId,
              quantity: validation.value.quantity,
            },
            key,
          );
        },
      );
    });
}

/**
 * The body of the command, with the key free when the body could not be read.
 *
 * A body that cannot be read is a request that never ran: the key is freed,
 * so the client can send the same key again with a body it wrote.
 */
function readCommandBody(
  req: Request,
  deps: ServerDependencies,
  userId: string,
  key: string | null,
): Promise<unknown> {
  return readJsonBody(req).catch(function afterUnreadableBody(error: unknown): never {
    releaseKey(deps, userId, key);
    throw error;
  });
}

/**
 * The command of the store, applied in the database.
 */
function runOperation(
  deps: ServerDependencies,
  operation: StoreOperation,
  command: StoreCommand,
  trainerId: string,
): Promise<unknown> {
  return operation(deps.admin, {
    itemId: command.itemId,
    quantity: command.quantity,
    trainerId,
  });
}

/**
 * The answer of a buy or a sale.
 *
 * The gold and the backpack that come back are the ones of the database, and
 * the new state is pushed to the channel of the account: the wallet and the
 * backpack of the player changed, and the screen has to know.
 *
 * The result is kept when the request carries a key: a retried request must
 * not charge the player twice.
 */
function readOutcome(
  deps: ServerDependencies,
  ctx: RequestContext,
  userId: string,
  trainerId: string,
  outcome: unknown,
  event: string,
  fields: RouteLogFields,
  key: string | null,
): Promise<Response> {
  const failure = readFailure(outcome);
  if (failure !== null) {
    // The command was refused by the database, so it was not applied: the key
    // is free and the client can send it again.
    releaseKey(deps, userId, key);
    const mapped = mapStoreOperationError(failure);
    return Promise.resolve(errorResponse(mapped.status, mapped.code, mapped.message));
  }
  const gold = readTotal(outcome, 'gold');
  const total = readTotal(outcome, 'total');
  return listStoreBag(deps.admin, trainerId).then(function withBag(bag: StoreBagItem[]): Response {
    deps.broadcaster.pushState(userId, trainerId);
    logRouteEvent(deps.logger, ctx, event, { ...fields, total });
    const body = { bag, gold, total };
    if (key !== null) {
      deps.idempotency.set(userId, key, { body, status: OK });
    }
    return jsonResponse(body, OK);
  });
}

function readFailure(outcome: unknown): { code: string; message: string } | null {
  if (!isRecord(outcome)) {
    return null;
  }
  if (typeof outcome.code !== 'string' || typeof outcome.message !== 'string') {
    return null;
  }
  return { code: outcome.code, message: outcome.message };
}

function readTotal(outcome: unknown, field: 'gold' | 'total'): number {
  if (!isRecord(outcome)) {
    return 0;
  }
  const value = outcome[field];
  return typeof value === 'number' ? value : 0;
}

function unauthenticatedResponse(): Response {
  return errorResponse(
    UNAUTHENTICATED,
    'unauthenticated',
    readStoreErrorMessage('unauthenticated'),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
