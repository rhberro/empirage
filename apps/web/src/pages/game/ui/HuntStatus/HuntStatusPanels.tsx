import * as React from 'react';

import type { HuntCommand } from '../../api/hunt-protocol';
import { PartyStatus } from './PartyStatus';
import { TrainerStatus } from './TrainerStatus';

type HuntStatusPanelsProps = { onCommand: (command: HuntCommand) => boolean };

export function HuntStatusPanels(props: HuntStatusPanelsProps): React.ReactElement {
  const { onCommand } = props;
  return (
    <div className="hunt-status">
      <TrainerStatus />
      <PartyStatus onCommand={onCommand} />
    </div>
  );
}
