import * as React from 'react';

import { selectDisplayedTrainerGold, useGameStore } from '../../model/game-store';

type AnimationCleanup = () => void;

function useOdometer(value: number): number {
  const [displayed, setDisplayed] = React.useState(value);
  const previous = React.useRef(value);
  const frame = React.useRef(0);

  function animateValue(): AnimationCleanup | undefined {
    const from = previous.current;
    if (from === value) {
      return undefined;
    }
    const duration = 420;
    const startedAt = globalThis.performance.now();
    function render(now: number): void {
      const progress = Math.min(1, (now - startedAt) / duration);
      setDisplayed(Math.round(from + (value - from) * progress));
      if (progress < 1) {
        frame.current = globalThis.requestAnimationFrame(render);
      }
    }
    previous.current = value;
    frame.current = globalThis.requestAnimationFrame(render);
    function stopAnimation(): void {
      globalThis.cancelAnimationFrame(frame.current);
    }
    return stopAnimation;
  }

  React.useEffect(animateValue, [value]);

  return displayed;
}

export function GoldStatus(): React.ReactElement {
  const gold = useGameStore(selectDisplayedTrainerGold);
  const displayedGold = useOdometer(gold);
  const formattedGold = displayedGold.toLocaleString('pt-BR');

  return (
    <section aria-label="Dinheiro atual" className="hunt-status__money">
      <span aria-hidden="true">¤</span>
      <strong>{formattedGold}</strong>
    </section>
  );
}
