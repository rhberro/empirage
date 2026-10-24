import type { ReactElement } from 'react';
import { useState } from 'react';

import { hasStaminaForHunt } from '~/features/hunt-area/model/huntAreaStamina';
import { useHuntCountdown } from '~/features/hunt-area/model/useHuntCountdown';
import { Button } from '~/shared/ui/button';

const START_LABEL = 'Iniciar caçada';
const LOW_STAMINA_LABEL = 'Stamina insuficiente';
const STARTING_LABEL = 'Entrando na caçada...';

type StartHuntButtonProps = {
  disabled?: boolean;
  onStart: () => Promise<boolean>;
  staminaMinutes: number;
};

/**
 * The button that starts the hunt.
 *
 * The wait to enter the area happens in the label of the button, and the real
 * start only happens after it: the drawer stays open while the server refuses
 * the hunt, so the player can read why.
 */
export function StartHuntButton(props: StartHuntButtonProps): ReactElement {
  const { disabled = false, onStart, staminaMinutes } = props;
  const [pending, setPending] = useState<boolean>(false);
  const { remaining, start } = useHuntCountdown(handleCountdownEnd);
  const hasStamina = hasStaminaForHunt(staminaMinutes);
  const label = readLabel(hasStamina, pending, remaining);
  const blocked = disabled || !hasStamina || remaining !== null || pending;

  function handleCountdownEnd(): void {
    setPending(true);
    onStart().then(handleStartResult, handleStartFailure);
  }

  function handleStartResult(started: boolean): void {
    if (!started) {
      setPending(false);
    }
  }

  function handleStartFailure(): void {
    setPending(false);
  }

  return (
    <Button disabled={blocked} tone="primary" width="full" onClick={start}>
      {label}
    </Button>
  );
}

function readLabel(hasStamina: boolean, pending: boolean, remaining: number | null): string {
  if (!hasStamina) {
    return LOW_STAMINA_LABEL;
  }
  if (pending) {
    return STARTING_LABEL;
  }
  if (remaining === null) {
    return START_LABEL;
  }
  return `Entrando na caçada em ${remaining}`;
}
