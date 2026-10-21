import type { StoreCatalog } from '@creatures/contracts/store';

import type { ApiDeps } from '~/shared/api/client';
import type { StoreClientErrorCode, StoreOutcome } from '~/shared/api/endpoints/storeReaders';
import { readCatalog, readErrorCode, readOutcome } from '~/shared/api/endpoints/storeReaders';
import { buildHeaders, isSuccessStatus } from '~/shared/api/http';

export { STORE_ERROR_CODES } from '~/shared/api/endpoints/storeReaders';
export type { StoreClientErrorCode, StoreOutcome } from '~/shared/api/endpoints/storeReaders';

const STORE_PATH = '/api/store';
const BUY_PATH = '/api/store/buy';
const SELL_PATH = '/api/store/sell';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const IN_FLIGHT_CODE = 'store_request_in_flight';
const MAX_IN_FLIGHT_RETRIES = 3;
const IN_FLIGHT_DELAYS_MS = [400, 800, 1600];

export type StoreCatalogResult =
  | { catalog: StoreCatalog; ok: true }
  | { code: StoreClientErrorCode; ok: false };

export type StoreCommandResult =
  | { ok: true; outcome: StoreOutcome }
  | { code: StoreClientErrorCode; ok: false };

/**
 * The catalog of the store, with the backpack of the trainer and his gold.
 */
export function requestStoreCatalog(deps: ApiDeps): Promise<StoreCatalogResult> {
  return deps.getAccessToken().then(buildCatalogRequester(deps));
}

/**
 * Buys an item of the store.
 *
 * The idempotency key is the key of the purchase: the same key is the same
 * purchase, so the server does not charge the player twice for it.
 */
export function requestStoreBuy(
  deps: ApiDeps,
  itemId: string,
  quantity: number,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<StoreCommandResult> {
  return requestStoreCommand(deps, BUY_PATH, itemId, quantity, idempotencyKey, signal);
}

/**
 * Sells a quantity of an item of the backpack.
 *
 * The idempotency key is the key of the sale: the same key is the same sale,
 * so the server does not pay the player twice for it.
 */
export function requestStoreSell(
  deps: ApiDeps,
  itemId: string,
  quantity: number,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<StoreCommandResult> {
  return requestStoreCommand(deps, SELL_PATH, itemId, quantity, idempotencyKey, signal);
}

function buildCatalogRequester(
  deps: ApiDeps,
): (token: string | null) => Promise<StoreCatalogResult> {
  return function readCatalogWithToken(token: string | null): Promise<StoreCatalogResult> {
    if (token === null) {
      return Promise.resolve({ code: 'unauthenticated', ok: false });
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'GET' };
    return globalThis
      .fetch(buildUrl(deps.baseUrl, STORE_PATH), init)
      .then(readCatalogResponse)
      .catch(readNetworkFailure);
  };
}

function requestStoreCommand(
  deps: ApiDeps,
  path: string,
  itemId: string,
  quantity: number,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<StoreCommandResult> {
  return deps.getAccessToken().then(function sendCommandWithToken(
    token: string | null,
  ): StoreCommandAnswer {
    if (token === null) {
      return { code: 'unauthenticated', ok: false };
    }
    const request: StoreCommandRequest = {
      deps,
      idempotencyKey,
      itemId,
      path,
      quantity,
      signal,
      token,
    };
    return sendCommand(request, 0);
  });
}

/**
 * The command of the store, with the key of the purchase.
 */
type StoreCommandRequest = {
  deps: ApiDeps;
  idempotencyKey: string | undefined;
  itemId: string;
  path: string;
  quantity: number;
  signal: AbortSignal | undefined;
  token: string;
};

/**
 * The answer of a command: the result itself, or the promise of it.
 */
type StoreCommandAnswer = StoreCommandResult | Promise<StoreCommandResult>;

/**
 * The command of the store, sent to the server.
 *
 * A request the server is still running is asked again with the same key: the
 * first request finishes and keeps the result, and the second one reads that
 * result instead of charging the player twice. The same key is what makes the
 * repetition safe — a new key would be a second purchase.
 */
function sendCommand(request: StoreCommandRequest, retries: number): Promise<StoreCommandResult> {
  if (request.signal?.aborted === true) {
    return Promise.resolve({ code: 'unknown', ok: false });
  }
  const headers = buildHeaders(request.token);
  if (request.idempotencyKey !== undefined) {
    headers.set(IDEMPOTENCY_HEADER, request.idempotencyKey);
  }
  const body = JSON.stringify({ itemId: request.itemId, quantity: request.quantity });
  const init = { body, headers, method: 'POST' };
  return globalThis
    .fetch(buildUrl(request.deps.baseUrl, request.path), init)
    .then(readCommandResponse)
    .catch(readNetworkFailure)
    .then(function afterAnswer(result: StoreCommandResult): StoreCommandAnswer {
      const inFlight = !result.ok && result.code === IN_FLIGHT_CODE;
      if (!inFlight || retries >= MAX_IN_FLIGHT_RETRIES) {
        return result;
      }
      return waitInFlight(IN_FLIGHT_DELAYS_MS[retries], request.signal).then(
        function afterWait(): StoreCommandAnswer {
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

function readCatalogResponse(response: Response): Promise<StoreCatalogResult> {
  return response
    .json()
    .then(buildCatalogResult(response.status), buildUnreadableResult(response.status));
}

function readCommandResponse(response: Response): Promise<StoreCommandResult> {
  return response
    .json()
    .then(buildCommandResult(response.status), buildUnreadableResult(response.status));
}

function buildCatalogResult(status: number): (body: unknown) => StoreCatalogResult {
  return function toCatalogResult(body: unknown): StoreCatalogResult {
    if (!isSuccessStatus(status)) {
      return { code: readErrorCode(status, body), ok: false };
    }
    const catalog = readCatalog(body);
    if (catalog === null) {
      return { code: 'unknown', ok: false };
    }
    return { catalog, ok: true };
  };
}

function buildCommandResult(status: number): (body: unknown) => StoreCommandResult {
  return function toCommandResult(body: unknown): StoreCommandResult {
    if (!isSuccessStatus(status)) {
      return { code: readErrorCode(status, body), ok: false };
    }
    const outcome = readOutcome(body);
    if (outcome === null) {
      return { code: 'unknown', ok: false };
    }
    return { ok: true, outcome };
  };
}

function buildUnreadableResult(status: number): () => { code: StoreClientErrorCode; ok: false } {
  return function toUnreadableResult(): { code: StoreClientErrorCode; ok: false } {
    return { code: readErrorCode(status, null), ok: false };
  };
}

function readNetworkFailure(): { code: StoreClientErrorCode; ok: false } {
  return { code: 'unknown', ok: false };
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}
