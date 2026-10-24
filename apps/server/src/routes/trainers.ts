import type { Trainer } from '@creatures/contracts/trainer';

import { deleteTrainer, listTrainers } from '~/db/trainerRepository';
import type { ServerDependencies } from '~/dependencies';
import { logRouteEvent } from '~/logging/routeLog';
import { defineRoute, errorResponse, jsonResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { composeProtectedRoute } from '~/routes/routeChain';
import { readTrainerErrorMessage } from '~/validation/trainer';

import {
  applyTrainerUpdate,
  checkTrainerLimit,
  createTrainerRecord,
  readCreatedTrainer,
  validateTrainerBody,
  validateTrainerUpdateBody,
} from './trainerFlow';
import type { TrainerStep } from './trainerFlow';

const TRAINERS_PATH = '/api/trainers';
const TRAINER_PATH = '/api/trainers/:id';
const CREATED = 201;
const OK = 200;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

export function createTrainerRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute('POST', TRAINERS_PATH, composeProtectedRoute(deps, handleCreateTrainer(deps))),
    defineRoute('GET', TRAINERS_PATH, composeProtectedRoute(deps, handleListTrainers(deps))),
    defineRoute('PATCH', TRAINER_PATH, composeProtectedRoute(deps, handleUpdateTrainer(deps))),
    defineRoute('DELETE', TRAINER_PATH, composeProtectedRoute(deps, handleDeleteTrainer(deps))),
  ];
}

function handleCreateTrainer(deps: ServerDependencies): RouteHandler {
  return function createTrainer(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    return readJsonBody(req)
      .then(validateTrainerBody)
      .then(checkTrainerLimit(deps, userId))
      .then(createTrainerRecord(deps, userId))
      .then(readCreatedTrainer(deps, userId))
      .then(function logCreated(value: TrainerStep<Trainer>): Response {
        const response = toCreatedResponse(value);
        if (!isResponseValue(value)) {
          logRouteEvent(deps.logger, ctx, 'trainer created', {
            gender: value.gender,
            name: value.name,
            starterSpeciesId: value.starterSpeciesId,
            trainerId: value.id,
          });
        }
        return response;
      });
  };
}

function handleListTrainers(deps: ServerDependencies): RouteHandler {
  return function listTrainersRoute(
    _req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    return listTrainers(deps.admin, userId).then(function toList(trainers: Trainer[]): Response {
      logRouteEvent(deps.logger, ctx, 'trainers listed', { count: trainers.length });
      return jsonResponse({ trainers }, OK);
    });
  };
}

function handleUpdateTrainer(deps: ServerDependencies): RouteHandler {
  return function updateTrainerRoute(
    req: Request,
    params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = params.id;
    if (trainerId === undefined) {
      return Promise.resolve(notFoundResponse());
    }
    return readJsonBody(req)
      .then(validateTrainerUpdateBody)
      .then(applyTrainerUpdate(deps, trainerId, userId))
      .then(function logUpdated(value: TrainerStep<Trainer>): Response {
        const response = toUpdatedResponse(value);
        if (!isResponseValue(value)) {
          logRouteEvent(deps.logger, ctx, 'trainer updated', {
            name: value.name,
            trainerId: value.id,
          });
        }
        return response;
      });
  };
}

function handleDeleteTrainer(deps: ServerDependencies): RouteHandler {
  return function deleteTrainerRoute(
    _req: Request,
    params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = params.id;
    if (trainerId === undefined) {
      return Promise.resolve(notFoundResponse());
    }
    return deleteTrainer(deps.admin, trainerId, userId).then(function toResponse(
      deleted: boolean,
    ): Response {
      if (!deleted) {
        return notFoundResponse();
      }
      // The deleted trainer cannot stay as the active one: the player would
      // be left pointing at a trainer that no longer exists.
      if (deps.sessions.get(userId) === trainerId) {
        closeHuntOf(deps, trainerId, userId);
        deps.sessions.clear(userId);
      }
      logRouteEvent(deps.logger, ctx, 'trainer deleted', { trainerId });
      const init = { status: NO_CONTENT };
      return new globalThis.Response(null, init);
    });
  };
}

/**
 * Closes the hunt of the trainer that is leaving, when it is running.
 *
 * Deleting the active trainer ends the hunt before the session is cleared: the
 * simulation writes its final state against a trainer that still exists.
 */
function closeHuntOf(deps: ServerDependencies, trainerId: string, userId: string): void {
  if (!deps.hunts.has(trainerId)) {
    return;
  }
  void deps.hunts.close(trainerId, 'trainer_switched').catch(function closeFailed(
    error: unknown,
  ): void {
    deps.logger.error({ err: error, trainerId, userId }, 'hunt close failed');
  });
}

function toCreatedResponse(value: TrainerStep<Trainer>): Response {
  if (isResponseValue(value)) {
    return value;
  }
  return jsonResponse(value, CREATED);
}

function toUpdatedResponse(value: TrainerStep<Trainer>): Response {
  if (isResponseValue(value)) {
    return value;
  }
  return jsonResponse(value, OK);
}

function isResponseValue(value: unknown): value is Response {
  return value instanceof globalThis.Response;
}

function readJsonBody(req: Request): Promise<unknown> {
  return req.json().then(readBody, readMissingBody);
}

function readBody(value: unknown): unknown {
  return value;
}

function readMissingBody(): null {
  return null;
}

function unauthenticatedResponse(): Response {
  return errorResponse(401, 'unauthenticated', readTrainerErrorMessage('unauthenticated'));
}

function notFoundResponse(): Response {
  return errorResponse(
    NOT_FOUND,
    'trainer_not_found',
    readTrainerErrorMessage('trainer_not_found'),
  );
}
