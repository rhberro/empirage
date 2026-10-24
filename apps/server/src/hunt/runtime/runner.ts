import type { Logger } from 'pino';

import type { HuntManager } from './types';

/**
 * The watchdog of the hunts of this process.
 *
 * The scheduler of each runtime is the normal publisher: it wakes the hunt on
 * its next exact instant. This interval is the safety net for a timer that was
 * lost and the clock of the checkpoint of the dirty states; it is not the path
 * that publishes a step.
 */
export type HuntRunner = {
  stop(): void;
};

/**
 * Starts the interval that advances every hunt of the process.
 */
export function startHuntRunner(
  manager: Pick<HuntManager, 'advanceAll'>,
  logger: Logger,
  intervalMs = 250,
): HuntRunner {
  let running = false;
  const timer = setInterval(function tick(): void {
    if (running) {
      return;
    }
    running = true;
    manager.advanceAll().then(
      function done(): void {
        running = false;
      },
      function failed(error: unknown): void {
        running = false;
        logger.error({ err: error }, 'hunt tick failed');
      },
    );
  }, intervalMs);
  return {
    stop(): void {
      clearInterval(timer);
    },
  };
}
