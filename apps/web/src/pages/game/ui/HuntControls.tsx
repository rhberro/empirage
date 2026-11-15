import type { BattleConfiguration, HuntCommand, HuntState } from '../api/hunt-protocol';
import { AbilityDialog } from './AbilityDialog';
import { CaptureDialog } from './CaptureDialog';
import { HealingItemDialog } from './HealingItemDialog';

type HuntControlsProps = {
  configuration: BattleConfiguration | undefined;
  hunt: HuntState | null;
  onCommand: (command: HuntCommand) => boolean;
};

export function HuntControls(props: HuntControlsProps): React.ReactElement {
  const { configuration, hunt, onCommand } = props;
  const state = hunt ?? configuration;
  if (!state) {
    return <div hidden />;
  }
  const {
    activeCreatureAbilities,
    activeCreatureAvailableAbilities,
    activeCreatureLevel,
    healingConfiguration,
    healingItems,
  } = state;
  return (
    <>
      <CaptureDialog
        configuration={state.captureConfiguration}
        items={state.captureItems}
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
