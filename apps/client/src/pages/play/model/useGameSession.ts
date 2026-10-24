import type { GameCommand } from '@creatures/contracts/game';
import type { PlayerState } from '@creatures/contracts/player';
import type { Tile } from '@creatures/contracts/world';
import type { NavigateFunction } from 'react-router-dom';

import type { HuntPhase } from '~/entities/hunt';
import { useSkillPanel } from '~/features/skill-panel';
import type { SkillPanelView } from '~/features/skill-panel';
import type { CommandResult, MoveResult } from '~/pages/play/model/gameProtocol';
import { buildSessionActions } from '~/pages/play/model/sessionActions';
import type { SessionActions } from '~/pages/play/model/sessionActions';
import { useCreatureSwap } from '~/pages/play/model/useCreatureSwap';
import type { CreatureSwapView, SwapExecutor } from '~/pages/play/model/useCreatureSwap';
import { useGameChannel } from '~/pages/play/model/useGameChannel';
import { useHuntSession } from '~/pages/play/model/useHuntSession';
import type { HuntSessionView } from '~/pages/play/model/useHuntSession';
import { usePlayerState, usePlayerStateStore } from '~/pages/play/model/usePlayerState';
import type { PlayerStateLoadResult, PlayerStateStatus } from '~/pages/play/model/usePlayerState';
import { usePlayOverlays } from '~/pages/play/model/usePlayOverlays';
import type { PlayOverlays } from '~/pages/play/model/usePlayOverlays';
import type { SkillCommandResult } from '~/shared/api';
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
  /** The state of the hunt: the phase, the snapshot and the exit. */
  hunt: HuntView;
  load: () => Promise<PlayerStateLoadResult>;
  /** The state of the backpack and the storage modals. */
  modals: GameModalsView;
  notify: (message: string) => void;
  onReconnect: () => void;
  /** Reads the state of the player again. */
  refresh: () => Promise<PlayerStateLoadResult>;
  /** Sends a command of the player to the server. */
  requestCommand: (command: GameCommand, reqId?: string) => Promise<CommandResult>;
  /** Sends the move of the player to the server. */
  requestMove: (target: Tile, reqId?: string) => Promise<MoveResult>;
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

export type HuntView = HuntOverlayView & {
  error: string | null;
  finalizeHunt: () => Promise<boolean>;
  hasSnapshot: boolean;
  phase: HuntPhase;
  startHunt: (areaId: string) => Promise<boolean>;
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
  const channel = useGameChannel({
    applySnapshot,
    navigate,
    onWarning: notify,
    refresh,
    state,
  });
  const huntSession = useHuntSession(channel, notify);
  const swap = useCreatureSwap({
    onFailed: notify,
    swapExecutor: buildHuntSwapExecutor(huntSession),
  });
  const session = buildSessionActions(signOut, navigate, notify, channel);
  const hunt = buildHuntView(huntSession, overlays);
  const modals = buildModalsView(overlays);
  return {
    actions,
    connectionLost: channel.connectionLost,
    error,
    hunt,
    load,
    modals,
    notify,
    onReconnect: channel.onReconnect,
    refresh,
    requestCommand: huntSession.requestCommand,
    requestMove: channel.requestMove,
    session,
    skillPanel,
    state,
    status,
    swap,
  };
}

function buildHuntView(session: HuntSessionView, overlays: PlayOverlays): HuntView {
  return {
    error: session.error,
    finalizeHunt: session.finalizeHunt,
    hasSnapshot: session.hasSnapshot,
    isOpen: overlays.isHuntOpen,
    onClose: overlays.onCloseHunt,
    phase: session.phase,
    startHunt: session.startHunt,
  };
}

/**
 * The swap during a hunt goes through the game command, not the REST route:
 * the REST route moves the team in the database, while the command swaps the
 * creature in the field. Outside a hunt the default REST executor is used.
 */
function buildHuntSwapExecutor(session: HuntSessionView): SwapExecutor | undefined {
  if (session.phase === 'idle') {
    return undefined;
  }
  return function huntSwap(creatureId: string): Promise<SkillCommandResult> {
    return session.requestCommand({ creatureId, type: 'swap_creature' }).then(function adapt(
      result: CommandResult,
    ): SkillCommandResult {
      if (result.ok) {
        return { ok: true };
      }
      return { code: 'invalid_team_command', ok: false };
    });
  };
}

function buildModalsView(overlays: PlayOverlays): GameModalsView {
  return {
    isBackpackOpen: overlays.isBackpackOpen,
    isStorageOpen: overlays.isStorageOpen,
    isStoreOpen: overlays.isStoreOpen,
    onCloseBackpack: overlays.onCloseBackpack,
    onCloseStorage: overlays.onCloseStorage,
    onCloseStore: overlays.onCloseStore,
  };
}
