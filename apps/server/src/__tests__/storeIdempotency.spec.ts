import { expect, test } from 'bun:test';

import { buildStoreAdmin } from './fakeAdmin';
import {
  BAD_REQUEST,
  CONFLICT,
  OK,
  STORE_BUY_PATH,
  TRAINER_ID,
  USER_ID,
  USER_TOKEN,
  buildDependencies,
  buildHandler,
  buildJsonRequest,
  readJson,
  send,
} from './support';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const KEY = 'key-of-the-purchase';

/**
 * The request of a purchase, with the key that says which purchase it is.
 */
function buildPurchase(key: string): Request {
  const request = buildJsonRequest(
    'POST',
    STORE_BUY_PATH,
    { itemId: ITEM_ID, quantity: 1 },
    USER_TOKEN,
  );
  request.headers.set('Idempotency-Key', key);
  return request;
}

function buildStoreDeps(calls: { count: number }): ReturnType<typeof buildDependencies> {
  const deps = buildDependencies({ admin: buildStoreAdmin({ calls, delayMs: 20 }) });
  deps.sessions.set(USER_ID, TRAINER_ID);
  return deps;
}

/**
 * Two purchases of the same key that arrive together charge the player once:
 * the second one finds the key taken and refuses to run.
 */
function buysOnlyOnceWhenTheKeyIsInFlight(): Promise<void> {
  const calls = { count: 0 };
  const deps = buildStoreDeps(calls);
  const handler = buildHandler(deps);
  const first = send(handler, buildPurchase(KEY));
  const second = send(handler, buildPurchase(KEY));
  return Promise.all([first, second]).then(function assertOutcomes(responses: Response[]): void {
    const statuses = responses.map(readStatus).toSorted();
    expect(statuses).toEqual([OK, CONFLICT]);
    expect(calls.count).toBe(1);
  });
}

/**
 * The retried request of a purchase that worked gets the answer of the first
 * one, without charging the player again.
 */
function answersTheRetryWithTheResultOfTheFirst(): Promise<void> {
  const calls = { count: 0 };
  const deps = buildStoreDeps(calls);
  const handler = buildHandler(deps);
  return send(handler, buildPurchase(KEY))
    .then(function first(): Promise<Response> {
      return send(handler, buildPurchase(KEY));
    })
    .then(function assertStatus(response: Response): Promise<void> {
      expect(response.status).toBe(OK);
      expect(calls.count).toBe(1);
      return readJson(response).then(assertOutcome);
    });
}

/**
 * A request that was refused frees the key: the client can send it again.
 */
function freesTheKeyOfARequestThatFailed(): Promise<void> {
  const calls = { count: 0 };
  const deps = buildStoreDeps(calls);
  const handler = buildHandler(deps);
  const request = buildJsonRequest(
    'POST',
    STORE_BUY_PATH,
    { itemId: ITEM_ID, quantity: 0 },
    USER_TOKEN,
  );
  request.headers.set('Idempotency-Key', KEY);
  return send(handler, request).then(function assertRefused(response: Response): Promise<void> {
    expect(response.status).toBe(BAD_REQUEST);
    expect(calls.count).toBe(0);
    return send(handler, buildPurchase(KEY)).then(function assertRan(answer: Response): void {
      expect(answer.status).toBe(OK);
      expect(calls.count).toBe(1);
    });
  });
}

/**
 * A request that the database refused frees the key: the client can send it
 * again.
 */
function freesTheKeyOfARefusedPurchase(): Promise<void> {
  const calls = { count: 0 };
  const deps = buildDependencies({
    admin: buildStoreAdmin({
      calls,
      error: { code: 'P0001', message: 'store_insufficient_gold' },
    }),
  });
  deps.sessions.set(USER_ID, TRAINER_ID);
  const handler = buildHandler(deps);
  return send(handler, buildPurchase(KEY)).then(function assertRefused(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(CONFLICT);
    expect(calls.count).toBe(1);
    return send(handler, buildPurchase(KEY)).then(function assertRan(answer: Response): void {
      expect(answer.status).toBe(CONFLICT);
      expect(calls.count).toBe(2);
    });
  });
}

/**
 * Without a key the command runs as it always did.
 */
function runsWithoutAKey(): Promise<void> {
  const calls = { count: 0 };
  const deps = buildStoreDeps(calls);
  const handler = buildHandler(deps);
  const request = buildJsonRequest(
    'POST',
    STORE_BUY_PATH,
    { itemId: ITEM_ID, quantity: 1 },
    USER_TOKEN,
  );
  return send(handler, request).then(function assertRan(response: Response): void {
    expect(response.status).toBe(OK);
    expect(calls.count).toBe(1);
  });
}

function readStatus(response: Response): number {
  return response.status;
}

function assertOutcome(body: unknown): void {
  const outcome = body as { gold: number; total: number };
  expect(outcome.gold).toBe(100);
  expect(outcome.total).toBe(20);
}

test('a purchase of a key in flight runs once', buysOnlyOnceWhenTheKeyIsInFlight);
test(
  'the retry of a purchase gets the result of the first',
  answersTheRetryWithTheResultOfTheFirst,
);
test('the key of a refused request is free', freesTheKeyOfARequestThatFailed);
test('the key of a refused purchase is free', freesTheKeyOfARefusedPurchase);
test('a purchase without a key runs', runsWithoutAKey);
