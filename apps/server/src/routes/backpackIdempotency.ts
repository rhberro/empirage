import type { ServerDependencies } from '~/dependencies';
import { errorResponse, jsonResponse } from '~/router';
import type { StoredResult } from '~/state/idempotency';
import { readDestroyItemErrorMessage } from '~/validation/inventory';

const CONFLICT = 409;
const REQUEST_IN_FLIGHT_ERROR = 'destroy_item_request_in_flight';

/**
 * Takes the key of the destroy command, and answers when the key is not free.
 *
 * The key is taken before the command runs: a request that arrives while the
 * other one is still running finds the key taken, and does not run. The same
 * key is the same command, so running it twice would destroy two units.
 */
export function claimDestroyItemKey(
  deps: ServerDependencies,
  userId: string,
  key: string | null,
): Response | null {
  if (key === null) {
    return null;
  }
  const stored = deps.idempotency.get(userId, key);
  if (stored !== undefined) {
    return replayResponse(stored);
  }
  if (!deps.idempotency.reserve(userId, key)) {
    return requestInFlightResponse();
  }
  return null;
}

/**
 * The answer the first request of the key already gave.
 *
 * The command answers with no content, so a result kept without a body is
 * replayed as an empty response.
 */
function replayResponse(stored: StoredResult): Response {
  if (stored.body === null) {
    return new globalThis.Response(null, { status: stored.status });
  }
  return jsonResponse(stored.body, stored.status);
}

function requestInFlightResponse(): Response {
  const message = readDestroyItemErrorMessage(REQUEST_IN_FLIGHT_ERROR);
  return errorResponse(CONFLICT, REQUEST_IN_FLIGHT_ERROR, message);
}
