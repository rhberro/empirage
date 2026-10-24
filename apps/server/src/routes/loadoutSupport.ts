import { mapTeamOperationError } from '~/db/errors';
import type { ServerDependencies } from '~/dependencies';
import { errorResponse } from '~/router';
import { readTrainerErrorMessage } from '~/validation/trainer';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const NO_CONTENT = 204;

/**
 * The loadout belongs to the trainer the session points at: the player does not
 * send the trainer with the command.
 */
export function readSessionTrainer(deps: ServerDependencies, userId: string): string | Response {
  const trainerId = deps.sessions.get(userId);
  if (trainerId === null) {
    return notFoundResponse();
  }
  return trainerId;
}

export function readJsonBody(req: Request): Promise<unknown> {
  return req.json().then(readBody, readMissingBody);
}

export function unauthenticatedResponse(): Response {
  return errorResponse(401, 'unauthenticated', readTrainerErrorMessage('unauthenticated'));
}

export function notFoundResponse(): Response {
  return errorResponse(
    NOT_FOUND,
    'trainer_not_found',
    readTrainerErrorMessage('trainer_not_found'),
  );
}

export function creatureNotFoundResponse(): Response {
  return errorResponse(
    NOT_FOUND,
    'creature_not_found',
    readTrainerErrorMessage('creature_not_found'),
  );
}

export function invalidCommandResponse(): Response {
  return errorResponse(
    BAD_REQUEST,
    'invalid_team_command',
    readTrainerErrorMessage('invalid_team_command'),
  );
}

/**
 * Tells the hunt of the trainer to read the loadout again.
 *
 * The edit already reached the database and the response does not wait for the
 * hunt: the runtime publishes a delta when the new loadout is in place, and a
 * failure there is logged instead of failing the command that already committed.
 */
export function refreshHuntLoadout(deps: ServerDependencies, userId: string): void {
  const trainerId = deps.sessions.get(userId);
  if (trainerId === null) {
    return;
  }
  deps.hunts.refreshLoadout(trainerId).catch(function logFailure(error: unknown): void {
    deps.logger.error({ err: error, trainerId }, 'hunt loadout refresh failed');
  });
}

/**
 * The answer of a command that writes the state.
 *
 * A command that changed the state pushes the new state to the channel of the
 * account, so the client applies it without asking for the state again. The
 * answer of the command itself stays empty: what the client needs is the
 * snapshot, and it arrives by the WebSocket.
 */
export function writeOutcomeResponse(
  deps: ServerDependencies,
  userId: string,
  trainerId: string,
  error: { code: string; message: string } | null,
): Response {
  if (error !== null) {
    const mapped = mapTeamOperationError(error);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
  deps.broadcaster.pushState(userId, trainerId);
  const init = { status: NO_CONTENT };
  return new globalThis.Response(null, init);
}

function readBody(value: unknown): unknown {
  return value;
}

function readMissingBody(): null {
  return null;
}
