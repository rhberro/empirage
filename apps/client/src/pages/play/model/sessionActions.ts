import type { NavigateFunction } from 'react-router-dom';

import { switchTrainer } from '~/pages/play/model/switchTrainer';
import type { SwitchTrainerResult } from '~/pages/play/model/switchTrainer';

const SIGNIN_PATH = '/signin';
const SWITCH_FAILED_MESSAGE = 'Não foi possível trocar de treinador. Tente de novo.';
const TRAINERS_PATH = '/trainers';

export type SessionActions = {
  onSignOut: () => void;
  onSwitchTrainer: () => void;
};

/**
 * The channel of the game, as the switch of the treinador needs it.
 *
 * The server closes the channel as the consequence of the switch: the close is
 * expected, and it is not a lost connection.
 */
export type TrainerSwitchGuard = {
  /** The next close of the server is not expected after all. */
  cancelExpectedClose: () => void;
  /** The next close of the server is the consequence of the switch. */
  expectServerClose: () => void;
};

/**
 * The two actions of the session, offered by the menu of the settings.
 *
 * Signing out ends the session of the account. Switching the trainer only
 * disconnects the trainer from the service: the session stays alive, and the
 * player goes back to the list of trainers.
 */
export function buildSessionActions(
  signOut: () => Promise<void>,
  navigate: NavigateFunction,
  notify: (message: string) => void,
  guard: TrainerSwitchGuard,
): SessionActions {
  return {
    onSignOut: handleSignOut(signOut, navigate),
    onSwitchTrainer: handleSwitchTrainer(navigate, notify, guard),
  };
}

function handleSignOut(signOut: () => Promise<void>, navigate: NavigateFunction): () => void {
  return function signOutAndRedirect(): void {
    signOut().then(redirectToSignin(navigate), noop);
  };
}

function handleSwitchTrainer(
  navigate: NavigateFunction,
  notify: (message: string) => void,
  guard: TrainerSwitchGuard,
): () => void {
  return function switchTrainerAndRedirect(): void {
    // The server closes the channel when the trainer is disconnected, and the
    // close that follows is the consequence of the command: the client does
    // not reconnect and does not call it a lost connection.
    guard.expectServerClose();
    switchTrainer().then(handleSwitchResult(navigate, notify, guard));
  };
}

function handleSwitchResult(
  navigate: NavigateFunction,
  notify: (message: string) => void,
  guard: TrainerSwitchGuard,
): (result: SwitchTrainerResult) => void {
  return function handleResult(result: SwitchTrainerResult): void {
    if (!result.ok) {
      // The trainer is still connected: the channel lives on.
      guard.cancelExpectedClose();
      notify(SWITCH_FAILED_MESSAGE);
      return;
    }
    navigate(TRAINERS_PATH, { replace: true });
  };
}

function redirectToSignin(navigate: NavigateFunction): () => void {
  return function redirect(): void {
    navigate(SIGNIN_PATH, { replace: true });
  };
}

function noop(): void {
  void 0;
}
