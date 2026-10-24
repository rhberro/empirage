import { useEffect, useRef, useState } from 'react';

const EXIT_SECONDS = 5;
const TICK_MS = 200;

export type HuntExitCountdown = {
  /** The seconds left, or null when the player is not leaving the hunt. */
  remaining: number | null;
  start: () => void;
};

/**
 * The wait to finalize the hunt.
 *
 * The wait is five seconds, and it happens in the button: the player stays in
 * the hunt while the button counts down.
 */
export function useHuntExitCountdown(onFinished: () => void): HuntExitCountdown {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const finishedRef = useRef<(() => void) | null>(null);

  useEffect(rememberFinished, [onFinished]);

  useEffect(startTicking, [deadline]);

  function rememberFinished(): void {
    finishedRef.current = onFinished;
  }

  function countDown(): void {
    if (deadline === null) {
      return;
    }
    const left = Math.ceil((deadline - Date.now()) / 1000);
    if (left <= 0) {
      setRemaining(null);
      setDeadline(null);
      finishedRef.current?.();
      return;
    }
    setRemaining(left);
  }

  function startTicking(): () => void {
    if (deadline === null) {
      return stopNothing;
    }
    const intervalId = setInterval(countDown, TICK_MS);
    return function stopTicking(): void {
      clearInterval(intervalId);
    };
  }

  function start(): void {
    setDeadline(Date.now() + EXIT_SECONDS * 1000);
    setRemaining(EXIT_SECONDS);
  }

  return { remaining, start };
}

function stopNothing(): void {
  void 0;
}
