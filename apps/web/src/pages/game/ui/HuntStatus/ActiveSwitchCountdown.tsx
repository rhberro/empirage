import * as React from 'react';

type ActiveSwitchCountdownProps = { cooldownEndsAt: number };
type EffectCleanup = () => void;

function calculateSeconds(cooldownEndsAt: number): number {
  const remainingMs = cooldownEndsAt - Date.now();
  if (remainingMs <= 0) {
    return 0;
  }
  return Math.ceil(remainingMs / 1_000);
}

export function ActiveSwitchCountdown(
  props: ActiveSwitchCountdownProps,
): React.ReactElement | null {
  const { cooldownEndsAt } = props;
  function getInitialSeconds(): number {
    return calculateSeconds(cooldownEndsAt);
  }
  const [seconds, setSeconds] = React.useState(getInitialSeconds);

  function startCountdown(): EffectCleanup | undefined {
    const initial = calculateSeconds(cooldownEndsAt);
    if (initial <= 0) {
      return undefined;
    }
    function updateSeconds(): void {
      const remaining = calculateSeconds(cooldownEndsAt);
      setSeconds(remaining);
    }
    const timer = globalThis.setInterval(updateSeconds, 1_000);
    function clearCountdown(): void {
      globalThis.clearInterval(timer);
    }
    return clearCountdown;
  }

  React.useEffect(startCountdown, [cooldownEndsAt]);

  if (seconds <= 0) {
    return null;
  }

  const label = `Troca disponível em ${seconds}s`;
  return <span className="hunt-status__switch-cooldown">{label}</span>;
}
