import { afterEach, beforeEach, expect, test } from 'bun:test';

import type { ApiDeps } from '~/shared/api/client';

import {
  requestStoreBuy,
  requestStoreCatalog,
  requestStoreSell,
  STORE_ERROR_CODES,
  type StoreCommandResult,
} from './store';

const BASE_URL = 'http://localhost:3001';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const IDEMPOTENCY_KEY = '4a1f0c22-7d31-4d9e-9c2f-1f0b6f1f2a10';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';

type FakeResponse = {
  json(): Promise<unknown>;
  status: number;
};

type FetchCall = {
  headers: Headers;
};

const DEPS: ApiDeps = {
  baseUrl: BASE_URL,
  getAccessToken: readToken,
};

const DEPS_WITHOUT_TOKEN: ApiDeps = {
  baseUrl: BASE_URL,
  getAccessToken: readNoToken,
};

let originalFetch: typeof globalThis.fetch;
let originalSetTimeout: typeof globalThis.setTimeout;
let pendingTimers: (() => void)[] = [];

beforeEach(saveOriginalGlobals);
afterEach(restoreOriginalGlobals);

function saveOriginalGlobals(): void {
  originalFetch = globalThis.fetch;
  originalSetTimeout = globalThis.setTimeout;
}

function restoreOriginalGlobals(): void {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
}

function readToken(): Promise<string | null> {
  return Promise.resolve('access-token');
}

function readNoToken(): Promise<string | null> {
  return Promise.resolve(null);
}

// The fetch that keeps the calls it received, so the test can read the headers.
function stubFetchWithCalls(answer: (index: number) => FakeResponse): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = function fetchStub(
    _input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    calls.push({ headers: readHeaders(init) });
    return Promise.resolve(answer(calls.length - 1) as unknown as Response);
  } as unknown as typeof globalThis.fetch;
  return calls;
}

function readHeaders(init: RequestInit | undefined): Headers {
  return new globalThis.Headers(init?.headers);
}

// The timers that fire right away: the test does not wait for the delay of the retry.
function stubImmediateTimers(): void {
  globalThis.setTimeout = immediateTimer as unknown as typeof globalThis.setTimeout;
}

function immediateTimer(callback: () => void): number {
  callback();
  return 0;
}

// The timers that wait for the test: the pending callback is the wait of the retry.
function stubPendingTimers(): (() => void)[] {
  pendingTimers = [];
  globalThis.setTimeout = pendingTimer as unknown as typeof globalThis.setTimeout;
  return pendingTimers;
}

function pendingTimer(callback: () => void): number {
  pendingTimers.push(callback);
  return 0;
}

// Lets the chain of the request run before the test reads what it did.
function flushMicrotasks(): Promise<void> {
  return new Promise<void>(function wait(resolve): void {
    originalSetTimeout(resolve, 0);
  });
}

function readCatalogBody(): Promise<unknown> {
  return Promise.resolve({
    bag: [
      {
        description: 'Restaura a vida.',
        itemId: ITEM_ID,
        name: 'Poção',
        quantity: 2,
        sellPrice: 108,
        slug: 'pocao',
      },
    ],
    gold: 500,
    items: [
      {
        description: 'Restaura a vida.',
        id: ITEM_ID,
        name: 'Poção',
        price: 120,
        slug: 'pocao',
      },
    ],
  });
}

function readOutcomeBody(): Promise<unknown> {
  return Promise.resolve({ bag: [], gold: 380, total: 120 });
}

function readRefusalBody(): Promise<unknown> {
  return Promise.resolve({ error: 'store_insufficient_gold' });
}

function readInFlightBody(): Promise<unknown> {
  return Promise.resolve({ error: 'store_request_in_flight' });
}

test('the catalog comes with the items, the bag and the gold', readsTheCatalog);
test('a buy answers with the new wallet', readsThePurchase);
test('a refusal carries the code of the store', readsTheRefusal);
test('a request without a token is unauthenticated', refusesWithoutToken);
test('the key of the purchase travels in the header', sendsTheIdempotencyKey);
test('a request without a key sends no key', sendsNoIdempotencyKey);
test('a request in flight is asked again with the same key', repeatsTheRequestInFlight);
test('a request that stays in flight ends as a refusal', givesUpOnTheRequestInFlight);
test('an aborted request does not wait for the retry', abortsTheWaitOfTheRetry);
test('the code of a request in flight is known', knowsTheInFlightCode);

function readsTheCatalog(): Promise<void> {
  stubFetchWithCalls(function answer(): FakeResponse {
    return { json: readCatalogBody, status: 200 };
  });
  return requestStoreCatalog(DEPS).then(function assertCatalog(
    result: Awaited<ReturnType<typeof requestStoreCatalog>>,
  ): void {
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.catalog.gold).toBe(500);
    expect(result.catalog.items).toHaveLength(1);
    expect(result.catalog.bag).toHaveLength(1);
    expect(result.catalog.bag[0]?.quantity).toBe(2);
  });
}

function readsThePurchase(): Promise<void> {
  stubFetchWithCalls(function answer(): FakeResponse {
    return { json: readOutcomeBody, status: 200 };
  });
  return requestStoreBuy(DEPS, ITEM_ID, 1).then(function assertPurchase(
    result: Awaited<ReturnType<typeof requestStoreBuy>>,
  ): void {
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.outcome.gold).toBe(380);
    expect(result.outcome.total).toBe(120);
  });
}

function readsTheRefusal(): Promise<void> {
  stubFetchWithCalls(function answer(): FakeResponse {
    return { json: readRefusalBody, status: 409 };
  });
  return requestStoreSell(DEPS, ITEM_ID, 1).then(function assertRefusal(
    result: Awaited<ReturnType<typeof requestStoreSell>>,
  ): void {
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe('store_insufficient_gold');
  });
}

function refusesWithoutToken(): Promise<void> {
  return requestStoreCatalog(DEPS_WITHOUT_TOKEN).then(function assertRefusal(
    result: Awaited<ReturnType<typeof requestStoreCatalog>>,
  ): void {
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe('unauthenticated');
  });
}

function sendsTheIdempotencyKey(): Promise<void> {
  const calls = stubFetchWithCalls(function answer(): FakeResponse {
    return { json: readOutcomeBody, status: 200 };
  });
  return requestStoreBuy(DEPS, ITEM_ID, 1, IDEMPOTENCY_KEY).then(function assertKey(): void {
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.get(IDEMPOTENCY_HEADER)).toBe(IDEMPOTENCY_KEY);
  });
}

function sendsNoIdempotencyKey(): Promise<void> {
  const calls = stubFetchWithCalls(function answer(): FakeResponse {
    return { json: readOutcomeBody, status: 200 };
  });
  return requestStoreSell(DEPS, ITEM_ID, 1).then(function assertKey(): void {
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.get(IDEMPOTENCY_HEADER)).toBeNull();
  });
}

function repeatsTheRequestInFlight(): Promise<void> {
  stubImmediateTimers();
  const calls = stubFetchWithCalls(function answer(index: number): FakeResponse {
    if (index === 0) {
      return { json: readInFlightBody, status: 409 };
    }
    return { json: readOutcomeBody, status: 200 };
  });
  return requestStoreBuy(DEPS, ITEM_ID, 1, IDEMPOTENCY_KEY).then(function assertResult(
    result: StoreCommandResult,
  ): void {
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.headers.get(IDEMPOTENCY_HEADER)).toBe(IDEMPOTENCY_KEY);
    expect(calls[1]?.headers.get(IDEMPOTENCY_HEADER)).toBe(IDEMPOTENCY_KEY);
  });
}

function givesUpOnTheRequestInFlight(): Promise<void> {
  stubImmediateTimers();
  const calls = stubFetchWithCalls(function answer(): FakeResponse {
    return { json: readInFlightBody, status: 409 };
  });
  return requestStoreBuy(DEPS, ITEM_ID, 1, IDEMPOTENCY_KEY).then(function assertRefusal(
    result: StoreCommandResult,
  ): void {
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe('store_request_in_flight');
    expect(calls).toHaveLength(4);
    expect(calls[3]?.headers.get(IDEMPOTENCY_HEADER)).toBe(IDEMPOTENCY_KEY);
  });
}

function abortsTheWaitOfTheRetry(): Promise<void> {
  const pending = stubPendingTimers();
  const calls = stubFetchWithCalls(function answer(): FakeResponse {
    return { json: readInFlightBody, status: 409 };
  });
  const controller = new globalThis.AbortController();
  const pendingResult = requestStoreBuy(DEPS, ITEM_ID, 1, IDEMPOTENCY_KEY, controller.signal);
  return flushMicrotasks()
    .then(function abortTheWait(): Promise<StoreCommandResult> {
      expect(calls).toHaveLength(1);
      expect(pending).toHaveLength(1);
      controller.abort();
      return pendingResult;
    })
    .then(function assertNoRetry(result: StoreCommandResult): void {
      expect(result.ok).toBe(false);
      expect(calls).toHaveLength(1);
    });
}

function knowsTheInFlightCode(): void {
  expect(STORE_ERROR_CODES.store_request_in_flight).toBe(true);
}
