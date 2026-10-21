import type { PlayerState } from '@creatures/contracts/player';
import type { NavigateFunction } from 'react-router-dom';

import { useSkillPanel } from '~/features/skill-panel';
import type { SkillPanelView } from '~/features/skill-panel';
import { buildSessionActions } from '~/pages/play/model/sessionActions';
import type { SessionActions } from '~/pages/play/model/sessionActions';
import { useCreatureSwap } from '~/pages/play/model/useCreatureSwap';
import type { CreatureSwapView } from '~/pages/play/model/useCreatureSwap';
import { useGameChannel } from '~/pages/play/model/useGameChannel';
import { usePlayerState, usePlayerStateStore } from '~/pages/play/model/usePlayerState';
import type { PlayerStateLoadResult, PlayerStateStatus } from '~/pages/play/model/usePlayerState';
import { usePlayOverlays } from '~/pages/play/model/usePlayOverlays';
import type { AlertInput } from '~/shared/ui/alert';

import { buildCommandNotifier, buildMessageNotifier, buildPlayActions } from './playAlerts';
import type { PlayActions } from './playAlerts';

export type GameSessionOptions = {
  navigate: NavigateFunction;
  show: (input: AlertInput) => string;
  signOut: () => Promise<void>;
};

export type GameSession = {
  actions: PlayActions;
  connectionLost: boolean;
  error: string | null;
  /** The state of the hunt areas overlay, the modal and its drawer. */
  hunt: HuntOverlayView;
  load: () => Promise<PlayerStateLoadResult>;
  /** The state of the backpack and the storage modals. */
  modals: GameModalsView;
  notify: (message: string) => void;
  onReconnect: () => void;
  session: SessionActions;
  skillPanel: SkillPanelView;
  state: PlayerState | null;
  status: PlayerStateStatus;
  swap: CreatureSwapView;
};

export type HuntOverlayView = {
  isOpen: boolean;
  onClose: () => void;
};

export type GameModalsView = {
  isBackpackOpen: boolean;
  isStorageOpen: boolean;
  isStoreOpen: boolean;
  onCloseBackpack: () => void;
  onCloseStorage: () => void;
  onCloseStore: () => void;
};

/**
 * Everything the screen of the game reads from the server.
 *
 * The state of the player, the channel of the game, the panels of the bar of
 * abilities and the manual swap of the creature live together here, so that
 * the screen stays a screen.
 */
export function useGameSession(options: GameSessionOptions): GameSession {
  const { navigate, show, signOut } = options;
  const store = usePlayerStateStore();
  const { applySnapshot, error, load, refresh, state, status } = usePlayerState(store);
  const overlays = usePlayOverlays();
  const notify = buildMessageNotifier(show);
  const actions = buildPlayActions(overlays);
  const skillPanel = useSkillPanel({
    onCommandFailed: buildCommandNotifier(show),
    state,
  });
  const swap = useCreatureSwap({ onFailed: notify });
  const channel = useGameChannel({
    applySnapshot,
    navigate,
    onWarning: notify,
    refresh,
    state,
  });
  const session = buildSessionActions(signOut, navigate, notify, channel);
  return {
    actions,
    connectionLost: channel.connectionLost,
    error,
    hunt: { isOpen: overlays.isHuntOpen, onClose: overlays.onCloseHunt },
    load,
    modals: {
      isBackpackOpen: overlays.isBackpackOpen,
      isStorageOpen: overlays.isStorageOpen,
      isStoreOpen: overlays.isStoreOpen,
      onCloseBackpack: overlays.onCloseBackpack,
      onCloseStorage: overlays.onCloseStorage,
      onCloseStore: overlays.onCloseStore,
    },
    notify,
    onReconnect: channel.onReconnect,
    session,
    skillPanel,
    state,
    status,
    swap,
  };
}
