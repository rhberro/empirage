import { expect, test } from 'bun:test';

import pino from 'pino';

import { startHuntRunner } from '~/hunt/runtime/runner';
import type { HuntManager } from '~/hunt/runtime/types';

const logger = pino({ level: 'silent' });
const INTERVAL_MS = 5;
const WAIT_MS = 40;

function buildManager(advanceAll: HuntManager['advanceAll']): Pick<HuntManager, 'advanceAll'> {
  return { advanceAll };
}

function advancesAndStops(): Promise<void> {
  let calls = 0;
  const runner = startHuntRunner(
    buildManager(function advanceAll(): Promise<void> {
      calls += 1;
      return Promise.resolve();
    }),
    logger,
    INTERVAL_MS,
  );
  return wait(WAIT_MS).then(function afterTicks(): Promise<void> {
    expect(calls).toBeGreaterThan(0);
    runner.stop();
    const atStop = calls;
    return wait(WAIT_MS).then(function afterStop(): void {
      expect(calls).toBe(atStop);
    });
  });
}

/**
 * A tick that fails is logged and the interval keeps running: a broken hunt
 * does not stop the others.
 */
function survivesAFailedTick(): Promise<void> {
  let calls = 0;
  const runner = startHuntRunner(
    buildManager(function advanceAll(): Promise<void> {
      calls += 1;
      if (calls === 1) {
        return Promise.reject(new Error('the first tick failed'));
      }
      return Promise.resolve();
    }),
    logger,
    INTERVAL_MS,
  );
  return wait(WAIT_MS).then(function afterTicks(): void {
    runner.stop();
    expect(calls).toBeGreaterThanOrEqual(2);
  });
}

function wait(milliseconds: number): Promise<void> {
  return new globalThis.Promise(function resolveAfter(resolve): void {
    setTimeout(resolve, milliseconds);
  });
}

test('the runner advances and the stop ends the timer', advancesAndStops);
test('a failed tick does not stop the runner', survivesAFailedTick);
