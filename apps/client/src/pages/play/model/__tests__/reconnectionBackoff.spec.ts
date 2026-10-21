import { expect, test } from 'bun:test';

import { computeBackoffDelay, DEFAULT_BACKOFF } from '~/pages/play/model/reconnectionBackoff';

/**
 * The wait between the attempts grows: a server that is down is not asked a
 * thousand times in a second.
 */
test('the wait grows with the attempts', function grows(): void {
  const first = computeBackoffDelay(0, { jitterRatio: 0 });
  const second = computeBackoffDelay(1, { jitterRatio: 0 });
  const third = computeBackoffDelay(2, { jitterRatio: 0 });
  expect(first).toBe(1000);
  expect(second).toBe(2000);
  expect(third).toBe(4000);
});

/**
 * The wait never passes the ceiling: a player that comes back does not wait
 * for minutes.
 */
test('the wait never passes the ceiling', function caps(): void {
  const wait = computeBackoffDelay(20, { jitterRatio: 0 });
  expect(wait).toBe(DEFAULT_BACKOFF.maxMs);
});

/**
 * The jitter keeps a crowd of clients from coming back at the same instant.
 */
test('the wait has a jitter', function jitters(): void {
  const low = computeBackoffDelay(3, { random: lowestRandom });
  const high = computeBackoffDelay(3, { random: highestRandom });
  expect(low).toBe(6400);
  expect(high).toBe(9600);
});

/**
 * The jitter of the wait is inside the band that was chosen.
 */
test('the jitter stays inside the band', function staysInside(): void {
  const wait = computeBackoffDelay(2, { random: middleRandom });
  expect(wait).toBe(4000);
});

function lowestRandom(): number {
  return 0;
}

function highestRandom(): number {
  return 1;
}

function middleRandom(): number {
  return 0.5;
}
