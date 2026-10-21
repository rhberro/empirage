import { findTrainerById } from '~/db/trainerRepository';
import type { ServerDependencies } from '~/dependencies';
import { logRouteEvent } from '~/logging/routeLog';
import { defineRoute, errorResponse, jsonResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { composeProtectedRoute } from '~/routes/routeChain';
import { loadPlayerState } from '~/state/playerState';
import { isUuid } from '~/validation/trainer';
import {
  DISCONNECTED_CLOSE_CODE,
  DISCONNECTED_CLOSE_REASON,
  REPLACED_CLOSE_CODE,
  REPLACED_CLOSE_REASON,
} from '~/ws/connections';

const SESSION_PATH = '/api/session/trainer';
const PLAYER_STATE_PATH = '/api/player/state';
const NO_CONTENT = 204;
const OK = 200;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const UNAUTHENTICATED_ERROR = 'unauthenticated';
const UNAUTHENTICATED_MESSAGE = 'Token inválido ou ausente.';
const TRAINER_NOT_FOUND_ERROR = 'trainer_not_found';
const TRAINER_NOT_FOUND_MESSAGE = 'Treinador não encontrado.';
const INVALID_TRAINER_ERROR = 'invalid_trainer';
const INVALID_TRAINER_MESSAGE = 'Identificador de treinador inválido.';

export function createPlayerRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute(
      'POST',
      SESSION_PATH,
      composeProtectedRoute(deps, handleSelectSessionTrainer(deps)),
    ),
    defineRoute(
      'DELETE',
      SESSION_PATH,
      composeProtectedRoute(deps, handleClearSessionTrainer(deps)),
    ),
    defineRoute('GET', PLAYER_STATE_PATH, composeProtectedRoute(deps, handleReadPlayerState(deps))),
  ];
}

/**
 * Opens the session of the trainer.
 *
 * The channel the account had open is closed: the account has one session and
 * one channel, and the old one would keep receiving the state of a session
 * that is not the one of the client anymore.
 */
function handleSelectSessionTrainer(deps: ServerDependencies): RouteHandler {
  return function selectSessionTrainer(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(errorResponse(401, UNAUTHENTICATED_ERROR, UNAUTHENTICATED_MESSAGE));
    }
    return readJsonBody(req)
      .then(readTrainerId)
      .then(checkTrainerOwnership(deps, userId))
      .then(function toResponse(result: Response | string): Response {
        if (typeof result === 'string') {
          deps.sessions.set(userId, result);
          deps.connections.disconnect(userId, REPLACED_CLOSE_CODE, REPLACED_CLOSE_REASON);
          logRouteEvent(deps.logger, ctx, 'trainer session opened', { trainerId: result });
          const init = { status: NO_CONTENT };
          return new globalThis.Response(null, init);
        }
        return result;
      });
  };
}

/**
 * Disconnects the trainer of the account.
 *
 * The session of the account stays alive: only the trainer is disconnected, so
 * the player goes back to the list of trainers without signing out.
 *
 * The channel of the account is closed with it: the screen of the game says
 * that the trainer stops any activity when it is disconnected, and a channel
 * left open would push the state of a session that does not exist anymore.
 */
function handleClearSessionTrainer(deps: ServerDependencies): RouteHandler {
  return function clearSessionTrainer(
    _req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(errorResponse(401, UNAUTHENTICATED_ERROR, UNAUTHENTICATED_MESSAGE));
    }
    deps.sessions.clear(userId);
    deps.connections.disconnect(userId, DISCONNECTED_CLOSE_CODE, DISCONNECTED_CLOSE_REASON);
    const init = { status: NO_CONTENT };
    return Promise.resolve(new globalThis.Response(null, init));
  };
}

/**
 * The state of the player.
 *
 * The client asks with the revision it already has: when the state of the
 * account is still in that revision, the answer is that there is nothing new,
 * and the body of the state is not sent again.
 */
function handleReadPlayerState(deps: ServerDependencies): RouteHandler {
  return function readPlayerState(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(errorResponse(401, UNAUTHENTICATED_ERROR, UNAUTHENTICATED_MESSAGE));
    }
    const trainerId = deps.sessions.get(userId);
    if (trainerId === null) {
      return Promise.resolve(notFoundResponse());
    }
    const rev = deps.revs.current(userId);
    const sinceRev = readSinceRev(req);
    if (sinceRev !== null && rev <= sinceRev) {
      return Promise.resolve(noContentResponse());
    }
    const revision = { epoch: deps.revs.epoch, rev };
    return loadPlayerState(deps.admin, trainerId, userId, revision).then(function toBody(
      state: unknown,
    ): Response {
      if (state === null) {
        return notFoundResponse();
      }
      return jsonResponse(state, OK);
    });
  };
}

/**
 * The revision the client already has.
 *
 * A value that is not a revision is ignored: the client gets the whole state,
 * which is always safe.
 */
function readSinceRev(req: Request): number | null {
  const value = new globalThis.URL(req.url).searchParams.get('sinceRev');
  if (value === null || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function checkTrainerOwnership(
  deps: ServerDependencies,
  userId: string,
): (trainerId: string | Response) => Promise<string | Response> {
  return function checkOwnership(trainerId: string | Response): Promise<string | Response> {
    if (typeof trainerId !== 'string') {
      return Promise.resolve(trainerId);
    }
    return findTrainerById(deps.admin, trainerId, userId).then(function readTrainer(
      trainer: { id: string } | null,
    ): string | Response {
      if (trainer === null) {
        return notFoundResponse();
      }
      return trainer.id;
    });
  };
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

function readTrainerId(body: unknown): string | Response {
  if (typeof body !== 'object' || body === null) {
    return errorResponse(BAD_REQUEST, INVALID_TRAINER_ERROR, INVALID_TRAINER_MESSAGE);
  }
  const trainerId = (body as { trainerId?: unknown }).trainerId;
  if (typeof trainerId !== 'string' || !isUuid(trainerId)) {
    return errorResponse(BAD_REQUEST, INVALID_TRAINER_ERROR, INVALID_TRAINER_MESSAGE);
  }
  return trainerId;
}

function noContentResponse(): Response {
  const init = { status: NO_CONTENT };
  return new globalThis.Response(null, init);
}

function notFoundResponse(): Response {
  return errorResponse(NOT_FOUND, TRAINER_NOT_FOUND_ERROR, TRAINER_NOT_FOUND_MESSAGE);
}
