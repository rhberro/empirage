import { createElement } from 'react';

import { SKILL_COMMAND_MESSAGES } from '~/features/skill-panel';
import type { PlayOverlays } from '~/pages/play/model/usePlayOverlays';
import { PlayAlertIcon, PlayAlertMessage } from '~/pages/play/ui/PlayAlert';
import type { TrainerClientErrorCode } from '~/shared/api';
import type { AlertInput } from '~/shared/ui/alert';

const ALERT_DURATION = 4000;

export type PlayActions = {
  onOpenBackpack: () => void;
  onOpenStore: () => void;
  onOpenStorage: () => void;
  onStartHunt: () => void;
};

/**
 * The alert of the screen of the game.
 *
 * Every message of the game goes through here: the action of the trainer, the
 * answer of the server and the commands of the bar of abilities.
 */
export function buildMessageNotifier(
  show: (input: AlertInput) => string,
): (message: string) => void {
  return function notify(message: string): void {
    show(buildAlert(message));
  };
}

/**
 * The alert of a command of the bar of abilities that the server refused.
 */
export function buildCommandNotifier(
  show: (input: AlertInput) => string,
): (code: TrainerClientErrorCode) => void {
  return function notifyFailure(code: TrainerClientErrorCode): void {
    show(buildAlert(SKILL_COMMAND_MESSAGES[code]));
  };
}

export function buildPlayActions(overlays: PlayOverlays): PlayActions {
  return {
    // The backpack, the storage, the hunt areas and the store belong to the
    // features that own them. The buttons of the toolbar hold the open state,
    // and the modals read it when they land.
    onOpenBackpack: overlays.onOpenBackpack,
    onOpenStorage: overlays.onOpenStorage,
    onOpenStore: overlays.onOpenStore,
    onStartHunt: overlays.onOpenHunt,
  };
}

export function buildNotifier(show: (input: AlertInput) => string, message: string): () => void {
  return function notify(): void {
    show(buildAlert(message));
  };
}

function buildAlert(message: string): AlertInput {
  return {
    content: createElement(PlayAlertMessage, { message }),
    duration: ALERT_DURATION,
    icon: createElement(PlayAlertIcon),
  };
}
