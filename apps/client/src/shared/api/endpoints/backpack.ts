import type { DestroyItemErrorCode } from '@creatures/contracts/inventory';

import type { ApiDeps } from '~/shared/api/client';
import { buildHeaders, isSuccessStatus } from '~/shared/api/http';

const DESTROY_PATH = '/api/backpack/destroy';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const IN_FLIGHT_CODE = 'destroy_item_request_in_flight';
const MAX_IN_FLIGHT_RETRIES = 3;
const IN_FLIGHT_DELAYS_MS = [400, 800, 1600];

/**
 * Every code the backpack answers with.
 *
 * The map is exhaustive by construction: adding a code to the contract without
 * adding it here breaks the build.
 */
export const DESTROY_ITEM_ERROR_CODES: Record<DestroyItemErrorCode, true> = {
  destroy_item_equipped: true,
  destroy_item_internal_error: true,
  destroy_item_invalid_item: true,
  destroy_item_not_in_backpack: true,
  destroy_item_request_in_flight: true,
  trainer_not_found: true,
  unauthenticated: true,
};

export type DestroyItemClientErrorCode = DestroyItemErrorCode | 'unknown';

export type DestroyItemCommandResult =
  | { ok: true }
  | { code: DestroyItemClientErrorCode; ok: false };

/**
 * Destroys one unit of an item of the backpack.
 *
 * The idempotency key is the key of the command: the same key is the same
 * destruction, so the server does not destroy a second unit for a retry.
 */
export function requestDestroyItem(
  deps: ApiDeps,
  itemId: string,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<DestroyItemCommandResult> {
  return deps.getAccessToken().then(function sendWithToken(
    token: string | null,
  ): DestroyItemCommandResult | Promise<DestroyItemCommandResult> {
    if (token === null) {
      return { code: 'unauthenticated', ok: false };
    }
    const request: DestroyItemRequest = { deps, idempotencyKey, itemId, signal, token };
    return sendCommand(request, 0);
  });
}

type DestroyItemRequest = {
  deps: ApiDeps;
  idempotencyKey: string | undefined;
  itemId: string;
  signal: AbortSignal | undefined;
  token: string;
};

type DestroyItemAnswer = DestroyItemCommandResult | Promise<DestroyItemCommandResult>;

/**
 * The command, sent to the server.
 *
 * A request the server is still running is asked again with the same key: the
 * first request finishes and keeps the result, and the second one reads that
 * result instead of destroying a second unit.
 */
function sendCommand(
  request: DestroyItemRequest,
  retries: number,
): Promise<DestroyItemCommandResult> {
  if (request.signal?.aborted === true) {
    return Promise.resolve({ code: 'unknown', ok: false });
  }
  const headers = buildHeaders(request.token);
  if (request.idempotencyKey !== undefined) {
    headers.set(IDEMPOTENCY_HEADER, request.idempotencyKey);
  }
  const body = JSON.stringify({ itemId: request.itemId });
  const init = { body, headers, method: 'POST' };
  return globalThis
    .fetch(buildUrl(request.deps.baseUrl, DESTROY_PATH), init)
    .then(readCommandResponse)
    .catch(readNetworkFailure)
    .then(function afterAnswer(result: DestroyItemCommandResult): DestroyItemAnswer {
      const inFlight = !result.ok && result.code === IN_FLIGHT_CODE;
      if (!inFlight || retries >= MAX_IN_FLIGHT_RETRIES) {
        return result;
      }
      return waitInFlight(IN_FLIGHT_DELAYS_MS[retries], request.signal).then(
        function afterWait(): DestroyItemAnswer {
          if (request.signal?.aborted === true) {
            return result;
          }
          return sendCommand(request, retries + 1);
        },
      );
    });
}

/**
 * The wait between the attempts of a request the server is still running.
 *
 * The refusal is not a failure of the operation: the operation is happening,
 * and the answer comes when it finishes. The wait ends early when the caller
 * aborts: the screen can close in the middle of it, and a pending timer would
 * keep the request alive for nothing.
 */
function waitInFlight(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>(function wait(resolve): void {
    if (signal?.aborted === true) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    function stopWaiting(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      signal?.removeEventListener('abort', onAbort);
    }
    function onAbort(): void {
      stopWaiting();
      resolve();
    }
    function onTimeout(): void {
      stopWaiting();
      resolve();
    }
    signal?.addEventListener('abort', onAbort);
    timer = setTimeout(onTimeout, delayMs);
  });
}

function readCommandResponse(response: Response): Promise<DestroyItemCommandResult> {
  if (isSuccessStatus(response.status)) {
    return Promise.resolve({ ok: true });
  }
  return response
    .json()
    .then(buildCommandResult(response.status), buildUnreadableResult(response.status));
}

function buildCommandResult(status: number): (body: unknown) => DestroyItemCommandResult {
  return function toCommandResult(body: unknown): DestroyItemCommandResult {
    return { code: readErrorCode(status, body), ok: false };
  };
}

function buildUnreadableResult(status: number): () => DestroyItemCommandResult {
  return function toUnreadableResult(): DestroyItemCommandResult {
    return { code: readErrorCode(status, null), ok: false };
  };
}

function readNetworkFailure(): DestroyItemCommandResult {
  return { code: 'unknown', ok: false };
}

/**
 * The code of a failed answer.
 *
 * The codes of the backpack live in their own namespace: the shared map of the
 * trainer knows nothing about them, so the body is the only source.
 */
function readErrorCode(status: number, body: unknown): DestroyItemClientErrorCode {
  const code = readBodyCode(body);
  if (code !== null) {
    return code;
  }
  if (status === 401) {
    return 'unauthenticated';
  }
  return 'unknown';
}

function readBodyCode(body: unknown): DestroyItemClientErrorCode | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const error = (body as { error?: unknown }).error;
  if (typeof error !== 'string') {
    return null;
  }
  return Object.hasOwn(DESTROY_ITEM_ERROR_CODES, error) ? (error as DestroyItemErrorCode) : null;
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}
