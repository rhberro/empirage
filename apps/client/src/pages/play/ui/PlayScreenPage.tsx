import type { PlayerState } from '@creatures/contracts/player';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { huntStore } from '~/entities/hunt';
import type { HuntPhase } from '~/entities/hunt';
import { useTeam } from '~/entities/team';
import { HuntAreaFlow } from '~/features/hunt-area';
import { buildTeamSlots, resolveActiveId } from '~/pages/play/model/teamSlots';
import { useGameSession } from '~/pages/play/model/useGameSession';
import type { GameSession, HuntView } from '~/pages/play/model/useGameSession';
import type { PlayerStateLoadResult, PlayerStateStatus } from '~/pages/play/model/usePlayerState';
import { useAuth } from '~/shared/auth';
import { useAlerts } from '~/shared/ui/alert';
import type { CreatureSlot } from '~/widgets/game-hud';

import { GameModals } from './GameModals';
import { GameScreen } from './GameScreen';
import { PlayLoadingState } from './PlayLoadingState';
import { PlayReconnectState } from './PlayReconnectState';

const TRAINERS_PATH = '/trainers';

function ignoreWakeLockError(): void {
  // Ignora: nem todo navegador suporta ou permite.
}

export function PlayScreenPage(): ReactElement {
  return <PlayScreenBody />;
}

function setupWakeLock(): () => void {
  let lock: WakeLockSentinel | null = null;

  function handleGranted(granted: WakeLockSentinel): void {
    lock = granted;
  }

  function requestLock(): void {
    if (!('wakeLock' in window.navigator)) {
      return;
    }
    window.navigator.wakeLock.request('screen').then(handleGranted, ignoreWakeLockError);
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      requestLock();
    }
  }

  requestLock();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function cleanup(): void {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (lock !== null) {
      void lock.release();
    }
  }

  return cleanup;
}

function PlayScreenBody(): ReactElement {
  const auth = useAuth();
  const navigate = useNavigate();
  const { show } = useAlerts();
  const game = useGameSession({ navigate, show, signOut: auth.signOut });
  const team = useTeamSlots();

  useEffect(loadInitialState(game.load, navigate), [game.load, navigate]);
  useEffect(handleHuntLeaving(game.hunt.phase, game.refresh), [game.hunt.phase, game.refresh]);
  useEffect(setupWakeLock, []);

  if (game.state === null) {
    return renderPendingState(game.status, game.error, game.onReconnect);
  }

  if (game.connectionLost) {
    return <PlayReconnectState detail={game.error} onRetry={game.onReconnect} />;
  }

  return renderGameScreen(game, team, game.state);
}

function renderGameScreen(game: GameSession, team: TeamSlots, state: PlayerState): ReactElement {
  const handleSelectCreature = buildCreatureSelector(
    team.select,
    game.swap.swapCreature,
    team.activeId,
  );
  return (
    <GameScreen
      actions={game.actions}
      activeId={team.activeId}
      cooldownRemainingMs={game.swap.cooldownRemainingMs}
      cooldownTotalMs={game.swap.cooldownTotalMs}
      hunt={game.hunt}
      panel={game.skillPanel}
      slots={team.slots}
      state={state}
      onOpenSlot={game.skillPanel.openPanel}
      onSelectCreature={handleSelectCreature}
      onSignOut={game.session.onSignOut}
      onSwitchTrainer={game.session.onSwitchTrainer}
      openSlot={game.skillPanel.openSlot}
      requestMove={game.requestMove}
    >
      <HuntAreas
        hunt={game.hunt}
        onStartHunt={game.hunt.startHunt}
        staminaMinutes={state.staminaMinutes}
      />
      <GameModals modals={game.modals} />
    </GameScreen>
  );
}

/**
 * The team of the screen, as the HUD reads it.
 *
 * O time vem da store do time, e nao do estado cru: a store tem a mudanca que
 * o cliente prediz, e por isso o time da tela muda no mesmo instante do
 * clique na janela de armazenamento, sem esperar o servidor responder.
 */
function useTeamSlots(): TeamSlots {
  const team = useTeam();
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);
  const slots = buildTeamSlots(team.team);
  // The server says which creature is in the field. The local selection only
  // takes over while the server has not answered yet.
  const activeId = resolveActiveId(slots, team.activeCreatureId ?? selectedCreatureId);
  return { activeId, select: setSelectedCreatureId, slots };
}

type TeamSlots = {
  activeId: string | null;
  select(id: string | null): void;
  slots: CreatureSlot[];
};

/**
 * The hunt areas: the modal of the list and the drawer of the details.
 *
 * The flow stays mounted for the city and the hunt, but it never opens during
 * a hunt: the play button is gone there, and a start that is still closing
 * must not cover the hunt scene.
 */
function HuntAreas(props: {
  hunt: HuntView;
  onStartHunt: (areaId: string) => Promise<boolean>;
  staminaMinutes: number;
}): ReactElement {
  const { hunt, onStartHunt, staminaMinutes } = props;
  const isOpen = hunt.isOpen && hunt.phase === 'idle';
  return (
    <HuntAreaFlow
      isOpen={isOpen}
      onClose={hunt.onClose}
      onStartHunt={onStartHunt}
      staminaMinutes={staminaMinutes}
    />
  );
}

/**
 * The screen waits for the state of the player: it loads, or it tells that
 * the connection is gone.
 */
function renderPendingState(
  status: PlayerStateStatus,
  error: string | null,
  onReconnect: () => void,
): ReactElement {
  if (status === 'error') {
    return <PlayReconnectState detail={error} onRetry={onReconnect} />;
  }
  return <PlayLoadingState />;
}

/**
 * The click on a team tab.
 *
 * The creature that is already in the field is not a swap, so it does nothing.
 */
function buildCreatureSelector(
  setSelectedCreatureId: (id: string | null) => void,
  swapCreature: (id: string) => void,
  activeId: string | null,
): (id: string) => void {
  return function selectCreature(id: string): void {
    if (id === activeId) {
      return;
    }
    setSelectedCreatureId(id);
    swapCreature(id);
  };
}

/**
 * The state of the player comes from the server, over REST.
 *
 * The account that has no active trainer cannot play: the screen sends the
 * player back to the list of trainers, where the trainer is chosen.
 */
function loadInitialState(
  load: () => Promise<PlayerStateLoadResult>,
  navigate: NavigateFunction,
): () => void {
  return function loadState(): void {
    load().then(function handleResult(result: PlayerStateLoadResult): void {
      if (result === 'no-trainer') {
        navigate(TRAINERS_PATH, { replace: true });
      }
    });
  };
}

/**
 * The hunt ended: the store forgets it and the player state is read again.
 *
 * The server already sent the final ledger; the state of the player is the
 * only thing the screen still has to catch up with.
 */
function handleHuntLeaving(
  phase: HuntPhase,
  refresh: () => Promise<PlayerStateLoadResult>,
): () => void {
  return function finishLeaving(): void {
    if (phase !== 'leaving') {
      return;
    }
    huntStore.getState().resetHunt();
    void refresh();
  };
}
