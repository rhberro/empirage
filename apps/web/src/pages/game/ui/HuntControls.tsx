import type { HuntCommand } from '../api/hunt-protocol';
import { AbilityDialog } from './AbilityDialog';
import { CaptureDialog } from './CaptureDialog';
import { HealingItemDialog } from './HealingItemDialog';

type HuntControlsProps = {
  onCommand: (command: HuntCommand) => boolean;
};

export function HuntControls(props: HuntControlsProps): React.ReactElement {
  const { onCommand } = props;
  return (
    <>
      <CaptureDialog onConfigure={onCommand} />
      <HealingItemDialog onConfigure={onCommand} />
      <AbilityDialog onConfigure={onCommand} />
    </>
  );
}
