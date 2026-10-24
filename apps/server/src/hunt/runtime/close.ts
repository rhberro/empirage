import type { HuntEndReason } from '@creatures/contracts/huntSession';

import {
  debitStamina,
  finishSession,
  healTrainerCreatures,
  saveHuntSimulation,
  saveTeamState,
} from '~/hunt/runtime/persistence';
import { toLedger } from '~/hunt/runtime/wire';

import { creditRemaining } from './effects';
import { readCloseReason } from './runtime';
import type { HuntManagerState } from './state';
import type { HuntManager, HuntRuntime } from './types';

/**
 * The public close, serialized with the other operations of the trainer.
 */
export function buildClose(state: HuntManagerState): HuntManager['close'] {
  return function close(trainerId: string, reason: HuntEndReason): Promise<void> {
    return state.enqueue(trainerId, function closeTask(): Promise<void> {
      const runtime = state.runtimes.get(trainerId);
      if (runtime === undefined) {
        return Promise.resolve();
      }
      return closeHunt(state, runtime, reason);
    });
  };
}

/**
 * Writes the final state, credits what is missing, heals the creatures and
 * closes the session.
 */
export function closeHunt(
  state: HuntManagerState,
  runtime: HuntRuntime,
  reason: HuntEndReason,
): Promise<void> {
  if (!state.runtimes.has(runtime.trainerId)) {
    return Promise.resolve();
  }
  state.scheduler?.clear(runtime.trainerId);
  markEnded(runtime, reason, state.now());
  const endedAt = runtime.state.endsAt;
  runtime.state.simulatedAt = endedAt;
  const endReason = readCloseReason(runtime, reason);
  // The events of the last window and a checkpoint already in flight must
  // finish before the final write, or the close would credit the same loot
  // twice or overwrite a newer state with an older one.
  return Promise.all([runtime.sideEffects, runtime.pendingCheckpoint ?? Promise.resolve()])
    .then(function afterPending(): Promise<void> {
      return creditRemaining(state.admin, runtime);
    })
    .then(function saveState(): Promise<void> {
      return saveHuntSimulation(state.admin, runtime.sessionId, runtime.state, runtime.startedAt);
    })
    .then(function saveTeam(): Promise<void> {
      return saveTeamState(state.admin, runtime.state.team);
    })
    .then(function closeSession(): Promise<void> {
      return finishSession(state.admin, runtime.sessionId, endReason, endedAt);
    })
    .then(function debit(): Promise<void> {
      const spentMinutes = Math.max(0, Math.floor((endedAt - runtime.startedAt) / 60_000));
      return debitStamina(state.admin, runtime.trainerId, runtime.staminaAtStart - spentMinutes);
    })
    .then(function heal(): Promise<void> {
      return healTrainerCreatures(state.admin, runtime.trainerId);
    })
    .then(function finish(): void {
      finishRuntime(state, runtime, endReason);
    });
}

function markEnded(runtime: HuntRuntime, reason: HuntEndReason, at: number): void {
  const state = runtime.state;
  if (state.ended) {
    return;
  }
  state.ended = true;
  state.endReason = reason;
  state.endsAt = at;
}

function finishRuntime(state: HuntManagerState, runtime: HuntRuntime, reason: HuntEndReason): void {
  state.scheduler?.clear(runtime.trainerId);
  state.runtimes.delete(runtime.trainerId);
  state.deps.onEnded?.(runtime.accountId, runtime.trainerId, {
    huntRev: runtime.huntRev,
    ledger: toLedger(runtime.state.ledger),
    reason,
  });
}
