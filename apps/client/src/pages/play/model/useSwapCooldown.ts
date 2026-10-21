import { useEffect, useState } from 'react';

import { playerStateSync } from '~/entities/team';

const TICK_MS = 200;

export type SwapCooldown = {
  /** The time left of the cooldown. */
  remainingMs: number;
  /** The whole time of the cooldown. */
  totalMs: number;
  /** Starts the countdown of the cooldown. */
  start: () => void;
};

/**
 * The countdown of the cooldown of the manual swap.
 *
 * The player sees the tabs waiting: the mask descends and the count tells how
 * long is left. The server decides when the swap is accepted again; the
 * countdown is what the client shows while it waits.
 *
 * The countdown runs on the clock of the server: the state that the server
 * pushes says what time it is there, and a client whose clock is behind does
 * not show a countdown that ends in the wrong minute.
 */
export function useSwapCooldown(totalMs: number): SwapCooldown {
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  useEffect(
    function trackCooldown(): (() => void) | undefined {
      if (cooldownUntil <= 0) {
        return undefined;
      }
      const timer = setInterval(function step(): void {
        const left = Math.max(0, cooldownUntil - playerStateSync.readServerTime());
        setRemainingMs(left);
        if (left <= 0) {
          clearInterval(timer);
        }
      }, TICK_MS);
      return function stop(): void {
        clearInterval(timer);
      };
    },
    [cooldownUntil],
  );

  function start(): void {
    setCooldownUntil(playerStateSync.readServerTime() + totalMs);
    setRemainingMs(totalMs);
  }

  return { remainingMs, start, totalMs };
}
