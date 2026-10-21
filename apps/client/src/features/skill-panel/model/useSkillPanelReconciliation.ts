import type { PlayerState } from '@creatures/contracts/player';
import { useEffect } from 'react';

import { isTriggerConfirmed, matchesPending } from './skillPanelPrediction';
import type { PendingLoadout } from './skillPanelPrediction';
import { readPendingLoadout } from './skillPanelQueue';
import { skillPanelStore } from './skillPanelStore';

/**
 * How long a local change waits for the confirmation of the server.
 *
 * A change that is never confirmed is a change the server did not accept: the
 * client goes back to the state it has.
 */
const PENDING_EXPIRY_MS = 8000;

/**
 * The reconciliation of the local change with the state of the server.
 *
 * The push of the server is the truth: when the state it carries is the
 * change the client predicted, the prediction has nothing left to say. The
 * client never asks for the state on its own: the command waits for the state
 * that confirms it, and asks for it only when the state does not come.
 */
export function useSkillPanelReconciliation(
  state: PlayerState | null,
  pending: PendingLoadout | null,
): void {
  useReconciliation(state);
  usePendingExpiry(pending);
  useResetOnUnmount();
}

/**
 * The state of the server confirms — or undoes — the change of the client.
 *
 * The prediction of the last command is the one that carries the changes of
 * all of them: it is the loadout the server ends up with when every command
 * lands.
 */
function useReconciliation(state: PlayerState | null): void {
  useEffect(
    function reconcile(): void {
      const current = readPendingLoadout(skillPanelStore.getState().commands);
      if (current !== null && matchesPending(state, current)) {
        skillPanelStore.getState().clearCommands();
      }
      const override = skillPanelStore.getState().triggerOverride;
      if (override !== null && isTriggerConfirmed(state, override.slot, override.percent)) {
        skillPanelStore.getState().clearTriggerOverride();
      }
    },
    [state],
  );
}

/**
 * A change that the server never confirms is a change the server refused.
 */
function usePendingExpiry(pending: PendingLoadout | null): void {
  useEffect(
    function schedule(): () => void {
      if (pending === null) {
        return noop;
      }
      const timer = setTimeout(function expire(): void {
        skillPanelStore.getState().clearCommands();
      }, PENDING_EXPIRY_MS);
      return function cancel(): void {
        clearTimeout(timer);
      };
    },
    [pending],
  );
}

/**
 * The panels belong to the screen of the game: leaving it closes them.
 */
function useResetOnUnmount(): void {
  useEffect(function reset(): () => void {
    return function onUnmount(): void {
      skillPanelStore.getState().reset();
    };
  }, []);
}

function noop(): void {
  void 0;
}
