import type { HuntSnapshot } from '@creatures/contracts/huntSim';

import type { ServerDependencies } from '~/dependencies';
import { HuntStartError } from '~/hunt/errors';
import type { HuntStartErrorCode } from '~/hunt/errors';
import { ensureHunt } from '~/hunt/runtime/ensure';
import { defineRoute, errorResponse, jsonResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { composeProtectedRoute } from '~/routes/routeChain';
import { isUuid } from '~/validation/trainer';

const HUNTS_PATH = '/api/hunts';
const CURRENT_HUNT_PATH = '/api/hunts/current';
const CREATED = 201;
const OK = 200;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const UNAUTHENTICATED_ERROR = 'unauthenticated';
const UNAUTHENTICATED_MESSAGE = 'Token inválido ou ausente.';
const INVALID_BODY_ERROR = 'invalid_hunt';
const INVALID_BODY_MESSAGE = 'Identificador de área de caça inválido.';
const TRAINER_NOT_FOUND_ERROR = 'trainer_not_found';
const TRAINER_NOT_FOUND_MESSAGE = 'Treinador não encontrado.';
const HUNT_NOT_FOUND_ERROR = 'hunt_not_found';
const HUNT_NOT_FOUND_MESSAGE = 'Nenhuma caçada ativa.';

const START_ERROR_STATUS: Record<HuntStartErrorCode, number> = {
  already_hunting: CONFLICT,
  area_not_found: NOT_FOUND,
  level_too_low: FORBIDDEN,
  no_viable_creature: CONFLICT,
  stamina_insufficient: CONFLICT,
};

const START_ERROR_MESSAGES: Record<HuntStartErrorCode, string> = {
  already_hunting: 'O treinador já está em uma caçada.',
  area_not_found: 'Área de caça não encontrada.',
  level_too_low: 'Nível insuficiente para entrar nesta área.',
  no_viable_creature: 'O time não tem nenhuma criatura capaz de lutar.',
  stamina_insufficient: 'Stamina insuficiente para iniciar a caçada.',
};

/**
 * The routes of the hunt of the trainer of the session.
 *
 * The trainer always comes from the token: the body carries only the area.
 */
export function createHuntRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute('POST', HUNTS_PATH, composeProtectedRoute(deps, handleStartHunt(deps))),
    defineRoute('GET', CURRENT_HUNT_PATH, composeProtectedRoute(deps, handleCurrentHunt(deps))),
    defineRoute('DELETE', CURRENT_HUNT_PATH, composeProtectedRoute(deps, handleFinishHunt(deps))),
  ];
}

function handleStartHunt(deps: ServerDependencies): RouteHandler {
  return function startHunt(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    return readHuntAreaId(req).then(function start(
      areaId: string | Response,
    ): Promise<Response> | Response {
      if (typeof areaId !== 'string') {
        return areaId;
      }
      const trainerId = deps.sessions.get(userId);
      if (trainerId === null) {
        return trainerNotFoundResponse(CONFLICT);
      }
      return deps.hunts.start({ accountId: userId, areaId, trainerId }).then(function started(
        snapshot: HuntSnapshot,
      ): Response {
        return jsonResponse({ hunt: snapshot }, CREATED);
      }, readStartFailure);
    });
  };
}

function handleCurrentHunt(deps: ServerDependencies): RouteHandler {
  return function currentHunt(
    _req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = deps.sessions.get(userId);
    if (trainerId === null) {
      return Promise.resolve(huntNotFoundResponse());
    }
    return ensureHunt(deps, trainerId).then(function toResponse(
      snapshot: HuntSnapshot | null,
    ): Response {
      if (snapshot === null) {
        return huntNotFoundResponse();
      }
      return jsonResponse({ hunt: snapshot }, OK);
    });
  };
}

function handleFinishHunt(deps: ServerDependencies): RouteHandler {
  return function finishHunt(
    _req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = deps.sessions.get(userId);
    if (trainerId === null) {
      return Promise.resolve(noContentResponse());
    }
    // The session may be open in the database without a runtime in this
    // process, after a restart. Hydrating it first is what makes the finish
    // close the row instead of answering 204 and leaving it open.
    return ensureHunt(deps, trainerId).then(function afterEnsure(
      snapshot: HuntSnapshot | null,
    ): Promise<Response> | Response {
      if (snapshot === null) {
        return noContentResponse();
      }
      return deps.hunts.finalize(trainerId).then(function finished(): Response {
        return noContentResponse();
      });
    });
  };
}

/**
 * Reads the area of the body, or the response of a body that is not one.
 */
function readHuntAreaId(req: Request): Promise<string | Response> {
  return req.json().then(readAreaId, readMissingBody);
}

function readAreaId(body: unknown): string | Response {
  if (typeof body !== 'object' || body === null) {
    return invalidBodyResponse();
  }
  const huntAreaId = (body as { huntAreaId?: unknown }).huntAreaId;
  if (typeof huntAreaId !== 'string' || !isUuid(huntAreaId)) {
    return invalidBodyResponse();
  }
  return huntAreaId;
}

function readMissingBody(): Response {
  return invalidBodyResponse();
}

/**
 * The refusal of the start, with the status and the message of the reason.
 */
function readStartFailure(error: unknown): Response {
  if (!(error instanceof HuntStartError)) {
    throw error;
  }
  return errorResponse(
    START_ERROR_STATUS[error.code],
    error.code,
    START_ERROR_MESSAGES[error.code],
  );
}

function invalidBodyResponse(): Response {
  return errorResponse(BAD_REQUEST, INVALID_BODY_ERROR, INVALID_BODY_MESSAGE);
}

function unauthenticatedResponse(): Response {
  return errorResponse(UNAUTHORIZED, UNAUTHENTICATED_ERROR, UNAUTHENTICATED_MESSAGE);
}

function trainerNotFoundResponse(status: number): Response {
  return errorResponse(status, TRAINER_NOT_FOUND_ERROR, TRAINER_NOT_FOUND_MESSAGE);
}

function huntNotFoundResponse(): Response {
  return errorResponse(NOT_FOUND, HUNT_NOT_FOUND_ERROR, HUNT_NOT_FOUND_MESSAGE);
}

function noContentResponse(): Response {
  const init = { status: NO_CONTENT };
  return new globalThis.Response(null, init);
}
