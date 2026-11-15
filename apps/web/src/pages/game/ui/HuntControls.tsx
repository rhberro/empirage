import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import { AbilityDialog } from './AbilityDialog';
import { CaptureDialog } from './CaptureDialog';
import { HealingItemDialog } from './HealingItemDialog';

type HuntControlsProps = { hunt: HuntState; onCommand: (command: HuntCommand) => boolean };

export function HuntControls(props: HuntControlsProps): React.ReactElement {
  const { hunt, onCommand } = props;
  const {
    activeCreatureAbilities,
    activeCreatureAvailableAbilities,
    activeCreatureLevel,
    healingConfiguration,
    healingItems,
  } = hunt;
  return (
    <>
      <CaptureDialog
        configuration={hunt.captureConfiguration}
        items={hunt.captureItems}
        onConfigure={onCommand}
      />
      <HealingItemDialog
        configuration={healingConfiguration}
        items={healingItems}
        onConfigure={onCommand}
      />
      <AbilityDialog
        abilities={activeCreatureAvailableAbilities}
        equipped={activeCreatureAbilities}
        level={activeCreatureLevel}
        onConfigure={onCommand}
      />
    </>
  );
}
