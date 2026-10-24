import { toDelta } from '~/hunt/runtime/wire';
import { finalizeHunt, swapActive } from '~/hunt/sim';

import { closeHunt } from './close';
import type { HuntManagerState } from './state';
import type { HuntManager } from './types';

/**
 * The swap of the active creature.
 */
export function buildSwap(state: HuntManagerState): HuntManager['swap'] {
  return function swap(trainerId: string, creatureId: string): Promise<boolean> {
    return state.enqueue(trainerId, function swapTask(): Promise<boolean> {
      return swapNow(state, trainerId, creatureId);
    });
  };
}

function swapNow(state: HuntManagerState, trainerId: string, creatureId: string): Promise<boolean> {
  const runtime = state.runtimes.get(trainerId);
  if (runtime === undefined) {
    return Promise.resolve(false);
  }
  const at = state.now();
  if (!swapActive(runtime.state, creatureId, at, runtime.content.map)) {
    return Promise.resolve(false);
  }
  runtime.dirty = true;
  runtime.huntRev += 1;
  state.deps.onDelta?.(runtime.accountId, trainerId, toDelta(runtime, [], [], at));
  state.scheduler?.arm(trainerId);
  return Promise.resolve(true);
}

/**
 * The finalization of the hunt by the choice of the player.
 */
export function buildFinalize(state: HuntManagerState): HuntManager['finalize'] {
  return function finalize(trainerId: string): Promise<void> {
    return state.enqueue(trainerId, function finalizeTask(): Promise<void> {
      return finalizeNow(state, trainerId);
    });
  };
}

function finalizeNow(state: HuntManagerState, trainerId: string): Promise<void> {
  const runtime = state.runtimes.get(trainerId);
  if (runtime === undefined) {
    return Promise.resolve();
  }
  finalizeHunt(runtime.state, state.now());
  runtime.dirty = true;
  runtime.huntRev += 1;
  state.scheduler?.clear(trainerId);
  return closeHunt(state, runtime, 'player_finalized');
}
