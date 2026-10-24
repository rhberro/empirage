import { expect, test } from 'bun:test';

import {
  cooldownRemainingFraction,
  formatDuration,
  perHour,
} from '~/entities/hunt/model/huntFormat';

/**
 * Durations read as minutes and seconds, and hours past the first hour.
 */
test('durations format as clock time', function durationsFormat(): void {
  expect(formatDuration(0)).toBe('00:00');
  expect(formatDuration(60_000)).toBe('01:00');
  expect(formatDuration(90_000)).toBe('01:30');
  expect(formatDuration(3_661_000)).toBe('1:01:01');
  expect(formatDuration(-1)).toBe('00:00');
});

/**
 * The rate per hour divides by the elapsed time, and is zero without it.
 */
test('the per-hour rate divides by the elapsed time', function perHourDivides(): void {
  expect(perHour(120, 2 * 3_600_000)).toBe(60);
  expect(perHour(60, 0)).toBe(0);
  expect(perHour(60, 3_600_000)).toBe(60);
});

/**
 * The cooldown fraction runs from one down to zero and clamps at both ends.
 */
test('the cooldown fraction runs from one to zero', function cooldownFraction(): void {
  expect(cooldownRemainingFraction(1000, 1000, 0)).toBe(1);
  expect(cooldownRemainingFraction(1000, 1000, 500)).toBe(0.5);
  expect(cooldownRemainingFraction(1000, 1000, 1000)).toBe(0);
  expect(cooldownRemainingFraction(1000, 1000, 2000)).toBe(0);
  expect(cooldownRemainingFraction(1000, 0, 0)).toBe(0);
});
