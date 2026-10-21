import { expect, test } from 'bun:test';

import { createRevCounter } from '~/state/rev';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

function countsTheRevisionsOfTheAccount(): void {
  const revs = createRevCounter();
  expect(revs.current(USER_ID)).toBe(0);
  expect(revs.next(USER_ID)).toBe(1);
  expect(revs.next(USER_ID)).toBe(2);
  expect(revs.current(USER_ID)).toBe(2);
}

/**
 * The revision of an account never goes back, and the accounts do not share
 * the counter.
 */
function keepsTheAccountsApart(): void {
  const revs = createRevCounter();
  expect(revs.next(USER_ID)).toBe(1);
  expect(revs.next(USER_ID)).toBe(2);
  expect(revs.next(OTHER_USER_ID)).toBe(1);
  expect(revs.current(USER_ID)).toBe(2);
  expect(revs.current(OTHER_USER_ID)).toBe(1);
}

/**
 * The epoch is the boot of the process: it is the same for every account and
 * it does not change while the process lives.
 */
function keepsTheEpochOfTheBoot(): void {
  const revs = createRevCounter();
  const other = createRevCounter();
  expect(revs.epoch).not.toBe('');
  expect(revs.epoch).toBe(revs.epoch);
  revs.next(USER_ID);
  expect(revs.epoch).toBe(revs.epoch);
  expect(other.epoch).not.toBe(revs.epoch);
}

test('the counter counts the revisions of the account', countsTheRevisionsOfTheAccount);
test('the counter keeps the accounts apart', keepsTheAccountsApart);
test('the epoch is the one of the boot', keepsTheEpochOfTheBoot);
