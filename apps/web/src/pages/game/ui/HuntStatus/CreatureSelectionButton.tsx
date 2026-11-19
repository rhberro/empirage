import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';
import type { HuntCommand } from '../../api/hunt-protocol';
import {
  selectActiveCreatureSwitchCompletesAt,
  selectActiveCreatureSwitchCooldownEndsAt,
  useGameStore,
} from '../../model/game-store';

type CreatureSelectionButtonProps = React.PropsWithChildren<{
  creature: CollectionCreature;
  health: number;
  isActive: boolean;
  onCommand: (command: HuntCommand) => boolean;
}>;

type TimeoutCleanup = () => void;
type SwitchCommand = HuntCommand & { type: 'switch_active_creature' };

function getInitialTimestamp(): number {
  return Date.now();
}

export function CreatureSelectionButton(props: CreatureSelectionButtonProps): React.ReactElement {
  const { children, creature, health, isActive, onCommand } = props;
  const completesAt = useGameStore(selectActiveCreatureSwitchCompletesAt);
  const cooldownEndsAt = useGameStore(selectActiveCreatureSwitchCooldownEndsAt);
  const [expiredAt, setExpiredAt] = React.useState(getInitialTimestamp);

  function handleCooldownEnd(): void {
    setExpiredAt(Date.now());
  }

  function scheduleCooldown(): TimeoutCleanup | undefined {
    if (cooldownEndsAt === undefined) {
      return undefined;
    }
    const remainingMs = cooldownEndsAt - Date.now();
    if (remainingMs <= 0) {
      return undefined;
    }
    const timer = globalThis.setTimeout(handleCooldownEnd, remainingMs);
    function cancelTimeout(): void {
      globalThis.clearTimeout(timer);
    }
    return cancelTimeout;
  }

  React.useEffect(scheduleCooldown, [cooldownEndsAt]);

  const hasCooldown = Boolean(cooldownEndsAt !== undefined && cooldownEndsAt > expiredAt);
  const canSwitch = !isActive && health > 0 && !completesAt && !hasCooldown;
  const disabled = !canSwitch;
  const ariaLabel = `Ativar ${creature.species.name}`;

  function switchActiveCreature(): void {
    const command: SwitchCommand = {
      creatureId: creature.id,
      type: 'switch_active_creature',
      version: 1,
    };
    onCommand(command);
  }

  return (
    <button
      aria-label={ariaLabel}
      className="hunt-status__creature-select"
      disabled={disabled}
      onClick={switchActiveCreature}
      type="button"
    >
      {children}
    </button>
  );
}
