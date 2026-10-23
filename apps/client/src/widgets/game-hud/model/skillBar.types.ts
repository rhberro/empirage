import type {
  EquippedAbility,
  EquippedConsumable,
  EquippedDevice,
} from '@creatures/contracts/skill';
import type { CreatureVitals, SkillSlot } from '@creatures/contracts/skill';
import type { ReactNode } from 'react';

export type StaminaGauge = {
  maxMinutes: number;
  minutes: number;
};

export type SkillBarProps = {
  /** Whether the bar is collapsed. */
  collapsed?: boolean;
  /** The button of the city shop, rendered above the bar. */
  shopButton?: ReactNode;
  /** The panel of selection that is open, drawn over the bar. */
  children?: ReactNode;
  /**
   * The abilities equipped in the four ability slots of the active creature.
   *
   * The state of the game carries them; without them the bar shows the empty
   * slots, because a fake ability is worse than an empty one.
   */
  equippedAbilities?: EquippedAbility[];
  /** The consumables equipped in the two consumable slots of the trainer. */
  equippedConsumables?: EquippedConsumable[];
  /** The capture device equipped in the device slot of the trainer. */
  equippedDevice?: EquippedDevice | null;
  /** The slot that opens the panel of selection. */
  onSlotPress?: (slot: SkillSlot) => void;
  /** The slot whose panel of selection is open. */
  openSlot?: SkillSlot | null;
  /** Called when the collapse button is pressed. */
  onToggle?: (collapsed: boolean) => void;
  stamina?: StaminaGauge;
  /** The life of the active creature. */
  vitals?: CreatureVitals | null;
};
