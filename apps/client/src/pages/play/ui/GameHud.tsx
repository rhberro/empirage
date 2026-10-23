import type { PlayerState } from '@creatures/contracts/player';
import type { SkillSlot } from '@creatures/contracts/skill';
import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';

import type { CreatureSlot, StaminaGauge } from '~/widgets/game-hud';
import { PlayButton, ShopButton, SkillBar, TeamStrip } from '~/widgets/game-hud';

type GameHudProps = {
  activeId: string | null;
  /** The time left of the cooldown of the manual swap. */
  cooldownRemainingMs: number;
  /** The whole time of the cooldown of the manual swap. */
  cooldownTotalMs: number;
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
 * The team of the trainer, the actions of the city and the skill bar with the
 * panel of selection that opens over it.
 */
export function GameHud(props: GameHudProps): ReactElement {
  const {
    activeId,
    cooldownRemainingMs,
    cooldownTotalMs,
    onOpenSlot,
    onOpenStore,
    onSelectCreature,
    onStartHunt,
    openSlot,
    panel,
    slots,
    state,
  } = props;
  const stamina = buildStamina(state);
  const [skillBarCollapsed, setSkillBarCollapsed] = useState<boolean>(false);
  return (
    <>
      <TeamStrip
        activeId={activeId}
        cooldownRemainingMs={cooldownRemainingMs}
        cooldownTotalMs={cooldownTotalMs}
        slots={slots}
        onSelect={onSelectCreature}
      />
      <PlayButton onClick={onStartHunt} />
      <SkillBar
        collapsed={skillBarCollapsed}
        equippedAbilities={state.equippedAbilities}
        equippedConsumables={state.equippedConsumables}
        equippedDevice={state.equippedDevice}
        openSlot={openSlot}
        shopButton={<ShopButton onClick={onOpenStore} />}
        stamina={stamina}
        vitals={state.activeVitals}
        onSlotPress={onOpenSlot}
        onToggle={setSkillBarCollapsed}
      >
        {panel}
      </SkillBar>
    </>
  );
}

function buildStamina(state: PlayerState): StaminaGauge {
  return { maxMinutes: state.maxStaminaMinutes, minutes: state.staminaMinutes };
}
