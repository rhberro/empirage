import { expect, test } from 'bun:test';

import { createIdempotencyStore } from '~/state/idempotency';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const KEY = 'key-of-the-request';
const BODY = { gold: 10, total: 20 };

/**
 * The same key answers with the result that was already given: a retried
 * request does not charge the player twice.
 */
function answersTheSameResult(): void {
  const store = createIdempotencyStore();
  expect(store.get(USER_ID, KEY)).toBeUndefined();
  store.set(USER_ID, KEY, { body: BODY, status: 200 });
  const stored = store.get(USER_ID, KEY);
  expect(stored?.status).toBe(200);
  expect(stored?.body).toEqual(BODY);
}

/**
 * The keys are independent, and the key of an account is not the key of
 * another account.
 */
function keepsTheKeysApart(): void {
  const store = createIdempotencyStore();
  store.set(USER_ID, KEY, { body: BODY, status: 200 });
  store.set(USER_ID, 'another-key', { body: { gold: 1 }, status: 200 });
  expect(store.get(USER_ID, 'another-key')?.body).toEqual({ gold: 1 });
  expect(store.get(OTHER_USER_ID, KEY)).toBeUndefined();
}

/**
 * The result leaves the memory when the window ends: a key that is old is a
 * key of a request that is not a retry anymore.
 */
function forgetsTheOldResult(): void {
  let now = 1_000;
  const store = createIdempotencyStore({
    now: function readNow(): number {
      return now;
    },
    ttlMs: 600_000,
  });
  store.set(USER_ID, KEY, { body: BODY, status: 200 });
  now = 1_000 + 600_000 + 1;
  expect(store.get(USER_ID, KEY)).toBeUndefined();
}

/**
 * The key is taken while the request runs: a second request of the same key
 * finds it taken and does not run.
 */
function takesTheKeyWhileTheRequestRuns(): void {
  const store = createIdempotencyStore();
  expect(store.reserve(USER_ID, KEY)).toBe(true);
  expect(store.reserve(USER_ID, KEY)).toBe(false);
  expect(store.get(USER_ID, KEY)).toBeUndefined();
}

/**
 * A key of another account is another key.
 */
function takesTheKeyOfEachAccountApart(): void {
  const store = createIdempotencyStore();
  expect(store.reserve(USER_ID, KEY)).toBe(true);
  expect(store.reserve(OTHER_USER_ID, KEY)).toBe(true);
}

/**
 * The key of a request that failed is free again.
 */
function freesTheKeyOfARequestThatFailed(): void {
  const store = createIdempotencyStore();
  expect(store.reserve(USER_ID, KEY)).toBe(true);
  store.release(USER_ID, KEY);
  expect(store.reserve(USER_ID, KEY)).toBe(true);
}

/**
 * The result of a request that worked outlives the request: a late release
 * does not erase the answer the client already got.
 */
function keepsTheResultOfARequestThatWorked(): void {
  const store = createIdempotencyStore();
  store.set(USER_ID, KEY, { body: BODY, status: 200 });
  store.release(USER_ID, KEY);
  expect(store.get(USER_ID, KEY)?.body).toEqual(BODY);
}

/**
 * The reservation of a request that died leaves the key free when the window
 * ends.
 */
function forgetsTheReservationOfARequestThatDied(): void {
  let now = 1_000;
  const store = createIdempotencyStore({
    now: function readNow(): number {
      return now;
    },
    ttlMs: 600_000,
  });
  expect(store.reserve(USER_ID, KEY)).toBe(true);
  now = 1_000 + 600_000 + 1;
  expect(store.reserve(USER_ID, KEY)).toBe(true);
}

test('the same key answers with the same result', answersTheSameResult);
test('the keys are independent', keepsTheKeysApart);
test('the old result is forgotten', forgetsTheOldResult);
test('the key is taken while the request runs', takesTheKeyWhileTheRequestRuns);
test('the key of each account is taken apart', takesTheKeyOfEachAccountApart);
test('the key of a request that failed is free', freesTheKeyOfARequestThatFailed);
test('the result of a request that worked is kept', keepsTheResultOfARequestThatWorked);
test(
  'the reservation of a request that died is forgotten',
  forgetsTheReservationOfARequestThatDied,
);
