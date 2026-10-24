import { Box } from '@chakra-ui/react';
import type { PlayerState } from '@creatures/contracts/player';
import type { SkillSlot } from '@creatures/contracts/skill';
import type { Tile } from '@creatures/contracts/world';
import type { ReactElement, ReactNode } from 'react';

import { HuntCanvas } from '~/entities/hunt';
import { WorldCanvas } from '~/entities/world/ui/WorldCanvas';
import type { SkillPanelView } from '~/features/skill-panel';
import type { HuntView } from '~/pages/play/model/useGameSession';
import { Text } from '~/shared/ui/text';
import type { CreatureSlot } from '~/widgets/game-hud';

import { GameHud } from './GameHud';
import { GameToolbar } from './GameToolbar';
import { SkillPanelHost } from './SkillPanelHost';

export type GameActions = {
  onOpenBackpack: () => void;
  onOpenStore: () => void;
  onOpenStorage: () => void;
  onStartHunt: () => void;
};

export type GameScreenProps = {
  actions: GameActions;
  activeId: string | null;
  children?: ReactNode;
  /** The time left of the cooldown of the manual swap. */
  cooldownRemainingMs: number;
  /** The whole time of the cooldown of the manual swap. */
  cooldownTotalMs: number;
  /** The hunt of the screen: the phase and the exit. */
  hunt: HuntView;
  /** The panel of selection that is open, over the bar. */
  panel: SkillPanelView;
  onOpenSlot: (slot: SkillSlot) => void;
  onSelectCreature: (id: string) => void;
  onSignOut: () => void;
  onSwitchTrainer: () => void;
  openSlot: SkillSlot | null;
  /** Sends a move of the player to the server. */
  requestMove: (target: Tile) => Promise<unknown>;
  slots: CreatureSlot[];
  state: PlayerState;
};

/**
 * The screen of the game: the toolbar, the scene and the HUD.
 *
 * The hunt takes the place of the city while the server runs it: the scene
 * gives place to the placeholder and the elements of the city are hidden.
 */
export function GameScreen(props: GameScreenProps): ReactElement {
  const { actions, onSignOut, onSwitchTrainer, state } = props;
  return (
    <Box display="flex" flexDirection="column" h="100dvh" overflow="hidden" w="full">
      <GameToolbar
        onOpenBackpack={actions.onOpenBackpack}
        onOpenStorage={actions.onOpenStorage}
        onSignOut={onSignOut}
        onSwitchTrainer={onSwitchTrainer}
        state={state}
      />
      <GameScene {...props} />
    </Box>
  );
}

function GameScene(props: GameScreenProps): ReactElement {
  const {
    actions,
    activeId,
    children,
    cooldownRemainingMs,
    cooldownTotalMs,
    hunt,
    onOpenSlot,
    onSelectCreature,
    openSlot,
    panel,
    requestMove,
    slots,
    state,
  } = props;
  const inHunt = hunt.phase !== 'idle';
  const leaving = hunt.phase === 'leaving';
  const transitioning = (hunt.phase === 'entering' && !hunt.hasSnapshot) || leaving;
  const scene = inHunt ? <HuntCanvas /> : <WorldCanvas requestMove={requestMove} />;
  const transitionOverlay = transitioning ? <HuntTransitionOverlay leaving={leaving} /> : null;
  return (
    <Box display="flex" flex="1" position="relative" touchAction="none">
      {scene}
      {transitionOverlay}
      <GameHud
        activeId={activeId}
        cooldownRemainingMs={cooldownRemainingMs}
        cooldownTotalMs={cooldownTotalMs}
        hunting={inHunt}
        onFinalize={hunt.finalizeHunt}
        onOpenSlot={onOpenSlot}
        onOpenStore={actions.onOpenStore}
        onSelectCreature={onSelectCreature}
        onStartHunt={actions.onStartHunt}
        openSlot={openSlot}
        panel={<SkillPanelHost panel={panel} />}
        slots={slots}
        state={state}
      />
      {children}
    </Box>
  );
}

/**
 * The subtle veil while the hunt loads or ends.
 *
 * It is not the global loading screen: the scene stays under it when the
 * snapshot already exists, so the hunt keeps drawing during the exit.
 */
function HuntTransitionOverlay(props: { leaving: boolean }): ReactElement {
  const { leaving } = props;
  const label = leaving ? 'Encerrando a caçada...' : 'Entrando na caçada...';
  return (
    <Box
      alignItems="center"
      bg="bg.overlay"
      display="flex"
      inset="0"
      justifyContent="center"
      pointerEvents="none"
      position="absolute"
      zIndex={3}
    >
      <Text color="fg" variant="label">
        {label}
      </Text>
    </Box>
  );
}
