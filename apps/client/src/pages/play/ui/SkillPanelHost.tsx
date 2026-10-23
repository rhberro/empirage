import type { ReactElement } from 'react';

import {
  ConsumableSelectionPanel,
  DeviceSelectionPanel,
  SkillPanelOverlay,
  SkillSelectionPanel,
  isAbilitySlot,
  isConsumableSlot,
} from '~/features/skill-panel';
import type { SkillPanelView } from '~/features/skill-panel';

type SkillPanelHostProps = {
  panel: SkillPanelView;
};

/**
 * The panel of selection that is open, over the bar.
 *
 * The panel follows the slot that was clicked: the abilities of the creature,
 * the consumables of the trainer or the capture device.
 */
export function SkillPanelHost(props: SkillPanelHostProps): ReactElement | null {
  const { panel } = props;
  const slot = panel.openSlot;
  if (slot === null) {
    return null;
  }
  if (isAbilitySlot(slot)) {
    return (
      <SkillPanelOverlay align="left">
        <SkillSelectionPanel
          entries={panel.abilityEntries}
          onSelect={panel.selectAbility}
          slot={slot}
        />
      </SkillPanelOverlay>
    );
  }
  if (isConsumableSlot(slot)) {
    return (
      <SkillPanelOverlay align="center">
        <ConsumableSelectionPanel
          entries={panel.consumableEntries}
          onSelect={panel.selectConsumable}
          onTriggerChange={panel.setTriggerHpPercent}
          slot={slot}
          triggerHpPercent={panel.triggerHpPercent}
        />
      </SkillPanelOverlay>
    );
  }
  return (
    <SkillPanelOverlay align="right">
      <DeviceSelectionPanel entries={panel.deviceEntries} onSelect={panel.selectDevice} />
    </SkillPanelOverlay>
  );
}
