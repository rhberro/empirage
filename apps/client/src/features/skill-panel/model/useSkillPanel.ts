import type { PlayerState } from '@creatures/contracts/player';
import type { SkillSlot } from '@creatures/contracts/skill';
import { DEVICE_SLOT } from '@creatures/contracts/skill';

import type { PanelCardEntry, SkillPanelOptions, SkillPanelView } from './skillPanel.types';
import { readTriggerChoice } from './skillPanelCommands';
import { buildAbilityEntries, buildConsumableEntries, buildDeviceEntries } from './skillPanelModel';
import { applyPending } from './skillPanelPrediction';
import { isSlotBusy, readPendingItemIds, readPendingLoadout } from './skillPanelQueue';
import type { PendingCommandList } from './skillPanelQueue';
import { skillPanelStore, useSkillPanelState } from './skillPanelStore';
import type { SkillPanelStoreState, TriggerOverride } from './skillPanelStore';
import { useSkillPanelReconciliation } from './useSkillPanelReconciliation';
import { useSkillPanelSelection } from './useSkillPanelSelection';

/**
 * The selection panels of the skill bar.
 *
 * The hook owns the slot that is open and the commands that change what is
 * equipped. The change is applied locally the instant the player clicks, and
 * the server is the authority: the state it pushes is the one that stays.
 */
export function useSkillPanel(
  options: SkillPanelOptions & { state: PlayerState | null },
): SkillPanelView {
  const { onCommandFailed, state } = options;
  const openSlot = useSkillPanelState(selectOpenSlot);
  const commands = useSkillPanelState(selectCommands);
  const triggerOverride = useSkillPanelState(selectTriggerOverride);
  const pending = readPendingLoadout(commands);
  const pendingItemIds = readPendingItemIds(commands);
  const effectiveState = applyPending(state, pending);
  const selection = useSkillPanelSelection(effectiveState, triggerOverride, onCommandFailed);
  useSkillPanelReconciliation(state, pending);
  const abilitySlot = openSlot ?? 0;
  const consumableSlot = openSlot ?? 4;
  return {
    abilityEntries: markPendingItems(
      buildAbilityEntries(effectiveState, abilitySlot),
      pendingItemIds,
      isSlotBusy(commands, abilitySlot),
    ),
    closePanel,
    consumableEntries: markPendingItems(
      buildConsumableEntries(effectiveState, consumableSlot),
      pendingItemIds,
      isSlotBusy(commands, consumableSlot),
    ),
    deviceEntries: markPendingItems(
      buildDeviceEntries(effectiveState),
      pendingItemIds,
      isSlotBusy(commands, DEVICE_SLOT),
    ),
    isBusy: commands.length > 0,
    openPanel,
    openSlot,
    selectAbility: selection.selectAbility,
    selectConsumable: selection.selectConsumable,
    selectDevice: selection.selectDevice,
    setTriggerHpPercent: selection.setTriggerHpPercent,
    triggerHpPercent: readTriggerChoice(effectiveState, openSlot, triggerOverride),
  };
}

function closePanel(): void {
  skillPanelStore.getState().closePanel();
}

/**
 * The items that are on their way cannot be clicked again.
 *
 * The card is disabled while the server answers: a second click would send
 * the same command twice, and the player would not know which one won. The
 * cards of a slot that is waiting are disabled too: the slot takes one
 * command at a time.
 */
function markPendingItems(
  entries: PanelCardEntry[],
  pendingItemIds: string[],
  slotIsBusy: boolean,
): PanelCardEntry[] {
  if (pendingItemIds.length === 0 && !slotIsBusy) {
    return entries;
  }
  return entries.map(function mark(entry: PanelCardEntry): PanelCardEntry {
    if (!slotIsBusy && !pendingItemIds.includes(entry.id)) {
      return entry;
    }
    return { ...entry, disabled: true };
  });
}

function openPanel(slot: SkillSlot): void {
  skillPanelStore.getState().openPanel(slot);
}

function selectCommands(state: SkillPanelStoreState): PendingCommandList {
  return state.commands;
}

function selectOpenSlot(state: SkillPanelStoreState): SkillSlot | null {
  return state.openSlot;
}

function selectTriggerOverride(state: SkillPanelStoreState): TriggerOverride | null {
  return state.triggerOverride;
}
