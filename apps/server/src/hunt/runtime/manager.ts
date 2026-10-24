import { buildAdvance, buildAdvanceAll } from './advance';
import { buildClose } from './close';
import { buildFinalize, buildSwap } from './commands';
import { buildHydrate, buildSnapshot, buildSweep } from './hydrate';
import { buildRefreshLoadout } from './loadout';
import { createHuntScheduler } from './scheduler';
import { buildStart } from './start';
import { createManagerState } from './state';
import type { HuntManager, HuntManagerDeps } from './types';

export type { HuntManager, HuntManagerDeps, HuntRuntime } from './types';

/**
 * The manager of the hunts of this process.
 *
 * It owns the runtime of each trainer, the serial queue of the operations of
 * that runtime and the scheduler that wakes each hunt on its next instant. The
 * periodic runner is only a watchdog and the checkpoint of the dirty states.
 */
export function createHuntManager(deps: HuntManagerDeps): HuntManager {
  const state = createManagerState(deps);
  const scheduler = createHuntScheduler(state, state.logger);
  state.scheduler = scheduler;
  return {
    advance: buildAdvance(state),
    advanceAll: buildAdvanceAll(state),
    close: buildClose(state),
    finalize: buildFinalize(state),
    has: function has(trainerId: string): boolean {
      return state.runtimes.has(trainerId);
    },
    hydrate: buildHydrate(state),
    refreshLoadout: buildRefreshLoadout(state),
    snapshot: buildSnapshot(state),
    start: buildStart(state),
    stop: scheduler.stop,
    swap: buildSwap(state),
    sweep: buildSweep(state),
  };
}
