import { Box } from '@chakra-ui/react';
import type { HuntAbilityCooldown, HuntCaptureDevice } from '@creatures/contracts/huntSim';
import type { PlayerState } from '@creatures/contracts/player';
import type {
  CreatureVitals,
  EquippedAbility,
  EquippedDevice,
  SkillSlot,
} from '@creatures/contracts/skill';
import { DEVICE_SLOT } from '@creatures/contracts/skill';
import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';

import {
  selectAbilities,
  selectDevice,
  selectTeam,
  selectVitals,
  useHuntState,
  useHuntStateShallow,
} from '~/entities/hunt';
import { TeamPanel } from '~/features/team-panel';
import type { CreatureSlot, DeviceDisplay, SlotCooldown, StaminaGauge } from '~/widgets/game-hud';
import { PlayButton, ShopButton, SkillBar, TeamStrip } from '~/widgets/game-hud';
import { useCanvasScale } from '~/widgets/game-hud/model/useCanvasScale';
import { HuntAnalyzerPanel } from '~/widgets/game-hud/ui/HuntAnalyzerPanel';
import { HuntSessionPanel } from '~/widgets/game-hud/ui/HuntSessionPanel';

type GameHudProps = {
  activeId: string | null;
  /** The time left of the cooldown of the manual swap. */
  cooldownRemainingMs: number;
  /** The whole time of the cooldown of the manual swap. */
  cooldownTotalMs: number;
  /** Whether the player is in a hunt: the elements of the city are hidden. */
  hunting?: boolean;
  /** Finalizes the hunt, with the five second wait on the button. */
  onFinalize: () => Promise<boolean>;
  onOpenSlot: (slot: SkillSlot) => void;
  onOpenStore: () => void;
  onSelectCreature: (id: string) => void;
  onStartHunt: () => void;
  openSlot: SkillSlot | null;
  /** The panel of selection that is open, over the bar. */
  panel: ReactNode;
  slots: CreatureSlot[];
  state: PlayerState;
};

/**
 * The elements of the game screen that float over the canvas.
 *
 * In the city it is the team, the play and shop buttons and the skill bar. In
 * the hunt the play and shop give place to the panels of the hunt, and the
 * skill bar reads the life and the cooldowns from the hunt store.
 */
// eslint-disable-next-line max-lines-per-function
export function GameHud(props: GameHudProps): ReactElement {
  const {
    // activeId,
    // cooldownRemainingMs,
    // cooldownTotalMs,
    hunting = false,
    onFinalize,
    // onOpenSlot,
    onOpenStore,
    // onSelectCreature,
    onStartHunt,
    // openSlot,
    // panel,
    // slots,
    // state,
  } = props;
  // const huntPlayer = useHuntStateShallow(selectVitals);
  // const huntAbilities = useHuntState(selectAbilities);
  // const huntDevice = useHuntState(selectDevice);
  // const huntTeam = useHuntState(selectTeam);
  // const activeCreatureId = hunting && huntPlayer !== null ? huntPlayer.id : activeId;
  // const [skillBarCollapsed, setSkillBarCollapsed] = useState<boolean>(false);
  const huntNodes = readHuntNodes(hunting, onFinalize, onStartHunt, onOpenStore);
  // const vitals = readVitals(hunting, huntPlayer, state.activeVitals);
  // const abilityCooldowns = hunting && huntAbilities !== null ? huntAbilities : undefined;
  // const equippedAbilities =
  //   hunting && huntAbilities !== null ? readHuntAbilities(huntAbilities) : state.equippedAbilities;
  // const equippedDevice = readDevice(hunting, huntDevice, state.equippedDevice);
  // const teamStripHuntTeam = hunting ? huntTeam : undefined;
  return (
    <>
      {/*<TeamStrip
        activeId={activeCreatureId}
        cooldownRemainingMs={cooldownRemainingMs}
        cooldownTotalMs={cooldownTotalMs}
        huntTeam={teamStripHuntTeam}
        slots={slots}
        onSelect={onSelectCreature}
      />*/}
      <TeamPanel />
      {huntNodes.panels}
      {huntNodes.playButton}
      {/*<GameSkillBar
        abilityCooldowns={abilityCooldowns}
        collapsed={skillBarCollapsed}
        equippedAbilities={equippedAbilities}
        equippedDevice={equippedDevice}
        openSlot={openSlot}
        panel={panel}
        shopButton={huntNodes.shopButton}
        state={state}
        vitals={vitals}
        onOpenSlot={onOpenSlot}
        onToggle={setSkillBarCollapsed}
      />*/}
    </>
  );
}

/**
 * The nodes that differ between the city and the hunt.
 */
function readHuntNodes(
  hunting: boolean,
  onFinalize: () => Promise<boolean>,
  onStartHunt: () => void,
  onOpenStore: () => void,
): { panels: ReactNode; playButton: ReactNode; shopButton: ReactNode | undefined } {
  if (!hunting) {
    return {
      panels: null,
      playButton: <PlayButton onClick={onStartHunt} />,
      shopButton: <ShopButton onClick={onOpenStore} />,
    };
  }
  return {
    panels: <HuntPanels onFinalize={onFinalize} />,
    playButton: null,
    shopButton: undefined,
  };
}

function GameSkillBar(props: {
  abilityCooldowns: SlotCooldown[] | undefined;
  collapsed: boolean;
  equippedAbilities: EquippedAbility[];
  equippedDevice: DeviceDisplay | null;
  onOpenSlot: (slot: SkillSlot) => void;
  onToggle: (collapsed: boolean) => void;
  openSlot: SkillSlot | null;
  panel: ReactNode;
  shopButton: ReactNode | undefined;
  state: PlayerState;
  vitals: CreatureVitals | null;
}): ReactElement {
  const {
    abilityCooldowns,
    collapsed,
    equippedAbilities,
    equippedDevice,
    onOpenSlot,
    onToggle,
    openSlot,
    panel,
    shopButton,
    state,
    vitals,
  } = props;
  const stamina = buildStamina(state);
  return (
    <SkillBar
      abilityCooldowns={abilityCooldowns}
      collapsed={collapsed}
      equippedAbilities={equippedAbilities}
      equippedConsumables={state.equippedConsumables}
      equippedDevice={equippedDevice}
      openSlot={openSlot}
      shopButton={shopButton}
      stamina={stamina}
      vitals={vitals}
      onSlotPress={onOpenSlot}
      onToggle={onToggle}
    >
      {panel}
    </SkillBar>
  );
}

/**
 * The device the bar shows: the one of the hunt while it runs, the equipped one
 * in the city.
 *
 * The hunt carries the multiplier and the quantity of the backpack, so the slot
 * shows the device with what it does and how many attempts are left.
 */
function readDevice(
  hunting: boolean,
  huntDevice: HuntCaptureDevice | null,
  fallback: EquippedDevice | null,
): DeviceDisplay | null {
  if (!hunting) {
    return fallback;
  }
  if (huntDevice === null) {
    return null;
  }
  return {
    itemId: huntDevice.itemId,
    multiplier: huntDevice.multiplier,
    name: huntDevice.name,
    quantity: huntDevice.quantity,
    slot: DEVICE_SLOT,
  };
}

/**
 * The life of the active creature, from the hunt while it runs.
 */
function readVitals(
  hunting: boolean,
  huntPlayer: { hp: number; maxHp: number } | null,
  activeVitals: CreatureVitals | null,
): CreatureVitals | null {
  if (hunting && huntPlayer !== null) {
    return { currentHp: huntPlayer.hp, maxHp: huntPlayer.maxHp };
  }
  return activeVitals;
}

/**
 * The abilities of the active creature of the hunt, in the shape the bar reads.
 *
 * The bar is of the creature in the field, so it follows the automatic swap:
 * the snapshot of the hunt carries the abilities of whoever is fighting now.
 */
function readHuntAbilities(cooldowns: HuntAbilityCooldown[]): EquippedAbility[] {
  return cooldowns.map(function toEquipped(cooldown: HuntAbilityCooldown): EquippedAbility {
    return {
      abilityId: cooldown.abilitySlug,
      cooldownMs: cooldown.cooldownMs,
      damage: 0,
      element: cooldown.element,
      name: cooldown.name,
      slot: cooldown.slot as SkillSlot,
      slug: cooldown.abilitySlug,
    };
  });
}

/**
 * The two panels of the hunt, stacked at the top left over the canvas.
 */
function HuntPanels(props: { onFinalize: () => Promise<boolean> }): ReactElement {
  const { onFinalize } = props;
  const scale = useCanvasScale();
  const scaleTransform = `scale(${scale})`;
  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="2"
      left="3"
      pointerEvents="auto"
      position="absolute"
      top="3"
      transform={scaleTransform}
      transformOrigin="top left"
      zIndex={2}
    >
      <HuntSessionPanel onFinalize={onFinalize} />
      <HuntAnalyzerPanel />
    </Box>
  );
}

function buildStamina(state: PlayerState): StaminaGauge {
  return { maxMinutes: state.maxStaminaMinutes, minutes: state.staminaMinutes };
}
