import type { HuntDelta } from '@creatures/contracts/huntSim';

import { saveHuntSimulation, saveTeamState } from '~/hunt/runtime/persistence';
import { isEmptyDelta, toDelta } from '~/hunt/runtime/wire';
import { advanceUntil } from '~/hunt/sim';

import { closeHunt } from './close';
import { applySideEffects } from './effects';
import { readCreatureId } from './runtime';
import type { HuntManagerState } from './state';
import type { HuntManager, HuntRuntime } from './types';

/** How often a dirty hunt is checkpointed, in milliseconds. */
const CHECKPOINT_INTERVAL_MS = 2000;

/**
 * One advance, serialized with the other operations of the trainer.
 *
 * The public advance waits for the backpack writes so a caller that changes the
 * state and reads it back sees the credit. The scheduler and the watchdog call
 * `advanceNow` directly and never wait for the database.
 */
export function buildAdvance(state: HuntManagerState): HuntManager['advance'] {
  return function advance(trainerId: string): Promise<HuntDelta | null> {
    return state.enqueue(trainerId, function advanceTask(): Promise<HuntDelta | null> {
      return advanceNow(state, trainerId).then(function afterAdvance(delta: HuntDelta | null) {
        const runtime = state.runtimes.get(trainerId);
        if (runtime === undefined) {
          return delta;
        }
        return runtime.sideEffects.then(function afterSideEffects(): HuntDelta | null {
          return delta;
        });
      });
    });
  };
}

/**
 * Moves the simulation to the present and publishes what changed.
 *
 * The database writes never hold the simulation: the side effects and the
 * checkpoint run in the background, and a close waits for both before the final
 * write. This is what keeps a slow Supabase from stalling a step that is due.
 */
export function advanceNow(state: HuntManagerState, trainerId: string): Promise<HuntDelta | null> {
  const runtime = state.runtimes.get(trainerId);
  if (runtime === undefined) {
    return Promise.resolve(null);
  }
  const at = state.now();
  const previousWildIds = runtime.lastWildIds;
  const result = advanceUntil(runtime.state, at, runtime.content);
  runtime.version += 1;
  const currentWildIds = runtime.state.wilds.map(readCreatureId);
  const removed = previousWildIds.filter(function isGone(id: string): boolean {
    return !currentWildIds.includes(id);
  });
  runtime.lastWildIds = currentWildIds;

  const delta = toDelta(runtime, result.events, removed, at);
  let published: HuntDelta | null = null;
  if (!isEmptyDelta(delta) || runtime.state.ended) {
    runtime.dirty = true;
    runtime.huntRev += 1;
    delta.huntRev = runtime.huntRev;
    published = delta;
    state.deps.onDelta?.(runtime.accountId, trainerId, published);
  }
  if (runtime.state.ended) {
    state.scheduler?.clear(trainerId);
  } else {
    state.scheduler?.arm(trainerId);
  }

  // The backpack writes travel in order, but the simulation does not wait for
  // them. The close awaits the chain before crediting what is left.
  runtime.sideEffects = runtime.sideEffects
    .then(function runSideEffects(): Promise<void> {
      return applySideEffects(state.admin, runtime, result.events);
    })
    .catch(function reportSideEffects(error: unknown): void {
      state.logger.error({ err: error, trainerId }, 'hunt side effects failed');
    });

  if (!runtime.state.ended) {
    return Promise.resolve(published);
  }
  return closeHunt(state, runtime, runtime.state.endReason ?? 'no_viable_creature').then(
    function ended(): HuntDelta | null {
      return published;
    },
  );
}

/**
 * The advance of every hunt of the process, with the checkpoint of the ones
 * that changed.
 *
 * A session that fails does not take the others down: the failure is logged
 * and the next tick tries it again.
 */
export function buildAdvanceAll(state: HuntManagerState): HuntManager['advanceAll'] {
  return function advanceAll(): Promise<void> {
    const trainers = [...state.runtimes.keys()];
    return Promise.all(trainers.map(buildAdvanceOne(state))).then(function done(): void {
      return undefined;
    });
  };
}

function buildAdvanceOne(state: HuntManagerState): (trainerId: string) => Promise<void> {
  return function advanceOne(trainerId: string): Promise<void> {
    return state
      .enqueue(trainerId, function advanceTask(): Promise<void> {
        return advanceAndCheckpoint(state, trainerId);
      })
      .catch(function logFailure(error: unknown): void {
        state.logger.error({ err: error, trainerId }, 'hunt advance failed');
      });
  };
}

function advanceAndCheckpoint(state: HuntManagerState, trainerId: string): Promise<void> {
  return advanceNow(state, trainerId).then(function maybeCheckpoint(): void {
    const runtime = state.runtimes.get(trainerId);
    if (runtime === undefined || !runtime.dirty || runtime.checkpointing) {
      return;
    }
    const at = state.now();
    if (at - runtime.lastCheckpointAt < CHECKPOINT_INTERVAL_MS) {
      return;
    }
    startCheckpoint(state, runtime, at);
  });
}

/**
 * Starts a checkpoint without holding the serial queue.
 *
 * The state is cloned first: the simulation keeps advancing while the row is
 * being written, and the clone is the state at the moment of the checkpoint.
 * The version says whether the state changed during the write; if it did, the
 * runtime stays dirty and the next interval writes again.
 */
function startCheckpoint(state: HuntManagerState, runtime: HuntRuntime, at: number): void {
  runtime.checkpointing = true;
  const version = runtime.version;
  const simulation = JSON.parse(JSON.stringify(runtime.state)) as typeof runtime.state;
  const promise = saveHuntSimulation(state.admin, runtime.sessionId, simulation, runtime.startedAt)
    .then(function saveTeam(): Promise<void> {
      return saveTeamState(state.admin, simulation.team);
    })
    .then(function done(): void {
      runtime.lastCheckpointAt = at;
      if (runtime.version === version) {
        runtime.dirty = false;
      }
    })
    .catch(function report(error: unknown): void {
      state.logger.error({ err: error, trainerId: runtime.trainerId }, 'hunt checkpoint failed');
    })
    .finally(function release(): void {
      runtime.checkpointing = false;
      runtime.pendingCheckpoint = null;
    });
  runtime.pendingCheckpoint = promise;
}
