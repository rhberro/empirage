import type { SkillSlot } from '@creatures/contracts/skill';

import type { TrainerClientErrorCode } from '~/shared/api';

/**
 * The group of a slot of the skill bar.
 *
 * The creature owns the ability slots, and the trainer owns the consumable and
 * the device slots.
 */
export type SkillSlotKind = 'ability' | 'consumable' | 'device';

/**
 * The kind of the icon a card draws.
 */
export type PanelCardKind = SkillSlotKind;

/**
 * One item of a selection panel.
 *
 * The panels share the same card: what changes between them is the data, not
 * the component.
 */
export type PanelCardEntry = {
  /** The text under the name. It is null when the item has no description. */
  description: string | null;
  /** The cooldown of an ability, in milliseconds. */
  cooldownMs?: number;
  /** The damage of an ability. */
  damage?: number;
  /** The item that cannot be used: without quantity in the backpack. */
  disabled: boolean;
  /** The element of an ability. */
  element?: import('@creatures/contracts/species').Element;
  /** The identifier the command of the panel uses. */
  id: string;
  kind: PanelCardKind;
  name: string;
  /** The line under the description: the cooldown, the quantity, the warning. */
  note: string | null;
  /** The item that is already equipped in the slot the panel edits. */
  selected: boolean;
};

/**
 * The life that triggers a consumable.
 *
 * The trigger is the percentage of life under which the consumable is used.
 */
export type TriggerHpPercent = number;

export type SkillPanelOptions = {
  /** Called when the server refuses a command of the panel. */
  onCommandFailed: (code: TrainerClientErrorCode) => void;
};

export type SkillPanelView = {
  abilityEntries: PanelCardEntry[];
  closePanel: () => void;
  consumableEntries: PanelCardEntry[];
  deviceEntries: PanelCardEntry[];
  isBusy: boolean;
  openPanel: (slot: SkillSlot) => void;
  openSlot: SkillSlot | null;
  selectAbility: (abilityId: string) => void;
  selectConsumable: (itemId: string) => void;
  selectDevice: (itemId: string) => void;
  setTriggerHpPercent: (percent: TriggerHpPercent) => void;
  triggerHpPercent: TriggerHpPercent;
};
