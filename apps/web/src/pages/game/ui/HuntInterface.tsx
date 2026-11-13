import { HuntCommand, HuntState } from '../api/hunt-protocol';
import { AbilityDialog } from './AbilityDialog';
import { BottomBar } from './BottomBar';
import { HealingItemDialog } from './HealingItemDialog';

type HuntInterfaceProps = { hunt: HuntState; sendHuntCommand: (command: HuntCommand) => boolean };

export function HuntInterface(props: HuntInterfaceProps): React.ReactElement {
  const { hunt, sendHuntCommand } = props;
  const {
    activeCreatureAbilities,
    activeCreatureAvailableAbilities,
    activeCreatureLevel,
    healingConfiguration,
    healingItems,
  } = hunt;
  return (
    <>
      <BottomBar hunt={hunt} onCommand={sendHuntCommand} />
      <HealingItemDialog
        configuration={healingConfiguration}
        items={healingItems}
        onConfigure={sendHuntCommand}
      />
      <AbilityDialog
        abilities={activeCreatureAvailableAbilities}
        equipped={activeCreatureAbilities}
        level={activeCreatureLevel}
        onConfigure={sendHuntCommand}
      />
    </>
  );
}
