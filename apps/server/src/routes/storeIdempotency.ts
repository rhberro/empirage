import type { ServerDependencies } from '~/dependencies';
import { errorResponse, jsonResponse } from '~/router';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const CONFLICT = 409;
const REQUEST_IN_FLIGHT_ERROR = 'store_request_in_flight';
const REQUEST_IN_FLIGHT_MESSAGE =
  'Esta operação já está em andamento. Tente novamente em alguns instantes.';

/**
 * The key that says which request the client is sending.
 *
 * The key is of single use by the client: the same key of a retried request
 * is the same purchase, and the server answers with the result it already
 * gave, without charging the player twice. A key that is empty or too long
 * is not a key, and the command runs as if there was none.
 */
export function readIdempotencyKey(req: Request): string | null {
  const value = req.headers.get(IDEMPOTENCY_HEADER);
  if (value === null) {
    return null;
  }
  const key = value.trim();
  if (key === '' || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return null;
  }
  return key;
}

/**
 * Takes the key of the request, and answers when the key is not free.
 *
 * The key is taken before the command runs: a request that arrives while the
 * other one is still running finds the key taken, and does not run. Without
 * the reservation, two requests of the same key would both find the key free
 * and both would charge the player.
 */
export function claimKey(
  deps: ServerDependencies,
  userId: string,
  key: string | null,
): Response | null {
  if (key === null) {
    return null;
  }
  const stored = deps.idempotency.get(userId, key);
  if (stored !== undefined) {
    return jsonResponse(stored.body, stored.status);
  }
  if (!deps.idempotency.reserve(userId, key)) {
    return requestInFlightResponse();
  }
  return null;
}

/**
 * Frees the key of the request.
 *
 * The key is freed only when the command is known not to have run: a command
 * that failed in the database may have been applied, and freeing the key
 * there would let the player be charged twice.
 */
export function releaseKey(deps: ServerDependencies, userId: string, key: string | null): void {
  if (key === null) {
    return;
  }
  deps.idempotency.release(userId, key);
}

/**
 * The answer of a request that is already running.
 *
 * The command of the other request is the same purchase: running it again
 * would charge the player twice, so the request is refused with the status
 * 409 and the player is not charged.
 */
function requestInFlightResponse(): Response {
  return errorResponse(CONFLICT, REQUEST_IN_FLIGHT_ERROR, REQUEST_IN_FLIGHT_MESSAGE);
}
