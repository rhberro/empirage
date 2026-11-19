import * as React from 'react';

import { selectActiveCreatureSwitchCooldownEndsAt, useGameStore } from '../../model/game-store';
import { ActiveSwitchCountdown } from './ActiveSwitchCountdown';

export function SwitchCooldown(): React.ReactElement | null {
  const cooldownEndsAt = useGameStore(selectActiveCreatureSwitchCooldownEndsAt);
  if (!cooldownEndsAt) {
    return null;
  }
  return <ActiveSwitchCountdown cooldownEndsAt={cooldownEndsAt} key={cooldownEndsAt} />;
}
