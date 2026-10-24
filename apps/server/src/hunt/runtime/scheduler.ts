import { nextInstant } from '~/hunt/sim';

import { advanceNow } from './advance';
import type { HuntManagerState } from './state';
import type { HuntScheduler } from './types';

type ScheduleState = {
  nextAt: Map<string, number>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
};

/**
 * The timer of the next instant of every hunt.
 *
 * The simulation is event-driven: a step ends, a wild decides, a wave or a
 * projectile reaches a tile, a spawn returns. The scheduler wakes the hunt
 * exactly at the next of those instants and publishes the delta there, so a
 * step is on the wire when it starts and the client can chain it to the
 * previous one without a gap.
 *
 * The periodic runner stays as a watchdog for a timer that was lost; it is not
 * the normal publisher.
 */
export function createHuntScheduler(
  state: HuntManagerState,
  logger: HuntManagerState['logger'],
): HuntScheduler {
  const schedule: ScheduleState = {
    nextAt: new Map<string, number>(),
    timers: new Map<string, ReturnType<typeof setTimeout>>(),
  };
  return {
    arm: function arm(trainerId: string): void {
      armHunt(state, schedule, logger, trainerId);
    },
    clear: function clear(trainerId: string): void {
      clearHunt(schedule, trainerId);
    },
    stop: function stop(): void {
      stopSchedule(schedule);
    },
  };
}

function armHunt(
  state: HuntManagerState,
  schedule: ScheduleState,
  logger: HuntManagerState['logger'],
  trainerId: string,
): void {
  clearHunt(schedule, trainerId);
  const runtime = state.runtimes.get(trainerId);
  if (runtime === undefined) {
    return;
  }
  const instant = nextInstant(runtime.state);
  if (instant === null) {
    return;
  }
  schedule.nextAt.set(trainerId, instant);
  const delay = Math.max(0, instant - state.now());
  const timer = setTimeout(buildDue(state, schedule, logger, trainerId), delay);
  // A timer must not keep the process alive after the hunts are gone.
  (timer as { unref?: () => void }).unref?.();
  schedule.timers.set(trainerId, timer);
}

function buildDue(
  state: HuntManagerState,
  schedule: ScheduleState,
  logger: HuntManagerState['logger'],
  trainerId: string,
): () => void {
  return function onDue(): void {
    schedule.timers.delete(trainerId);
    schedule.nextAt.delete(trainerId);
    state
      .enqueue(trainerId, function advanceTask(): Promise<unknown> {
        return advanceNow(state, trainerId);
      })
      .catch(function report(error: unknown): void {
        logger.error({ err: error, trainerId }, 'hunt schedule failed');
      });
  };
}

function clearHunt(schedule: ScheduleState, trainerId: string): void {
  const timer = schedule.timers.get(trainerId);
  if (timer !== undefined) {
    clearTimeout(timer);
    schedule.timers.delete(trainerId);
  }
  schedule.nextAt.delete(trainerId);
}

function stopSchedule(schedule: ScheduleState): void {
  for (const timer of schedule.timers.values()) {
    clearTimeout(timer);
  }
  schedule.timers.clear();
  schedule.nextAt.clear();
}
