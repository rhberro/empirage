import { useEffect, useState } from 'react';

import { worldStore } from '~/entities/world';

const TICK_MS = 1000;
const FRAME_MS = 150;

/**
 * The clock of the hunt, read from the world store.
 *
 * The hunt has no clock of its own: the countdowns and the elapsed time are
 * derived from the offset the world store already keeps.
 */
export function useHuntTick(): number {
  const [now, setNow] = useState<number>(readNow);
  useEffect(buildTicker(setNow, TICK_MS), []);
  return now;
}

/**
 * The clock of the hunt at a faster rate, for the cooldown masks.
 *
 * It ticks only while the hunt is on, so the city pays nothing for it.
 */
export function useHuntFrame(active: boolean): number {
  const [now, setNow] = useState<number>(readNow);
  useEffect(syncFrame(active, setNow), [active]);
  return now;
}

function readNow(): number {
  return worldStore.getState().now();
}

function buildTicker(setNow: (now: number) => void, intervalMs: number): () => () => void {
  return function startTicker(): () => void {
    setNow(readNow());
    const intervalId = setInterval(function tick(): void {
      setNow(readNow());
    }, intervalMs);
    return function stopTicker(): void {
      clearInterval(intervalId);
    };
  };
}

function syncFrame(active: boolean, setNow: (now: number) => void): () => () => void {
  return function startFrame(): () => void {
    setNow(readNow());
    if (!active) {
      return stopNothing;
    }
    const intervalId = setInterval(function tick(): void {
      setNow(readNow());
    }, FRAME_MS);
    return function stopTicker(): void {
      clearInterval(intervalId);
    };
  };
}

function stopNothing(): void {
  void 0;
}
