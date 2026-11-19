/* eslint-disable oxsome/no-inline-structural-types */
import {
  MAX_HISTORY_LENGTH,
  type HuntingLocationMapTile,
  type HuntingLocationSpecialTile,
  type MapSnapshot,
} from './types';

export const EMPTY_SNAPSHOT_STACK: Array<MapSnapshot> = [];

export function captureMapSnapshot(
  width: number,
  height: number,
  tiles: Array<HuntingLocationMapTile>,
  specialTiles: Array<HuntingLocationSpecialTile>,
): MapSnapshot {
  return {
    height,
    specialTiles: Array.from(specialTiles),
    tiles: Array.from(tiles),
    width,
  };
}

export function pushSnapshotToStack(
  stack: Array<MapSnapshot>,
  snapshot: MapSnapshot,
): Array<MapSnapshot> {
  const trimmed = stack.slice(-MAX_HISTORY_LENGTH + 1);
  return [...trimmed, snapshot];
}

export function popSnapshotFromStack(stack: Array<MapSnapshot>): {
  popped: MapSnapshot | null;
  remaining: Array<MapSnapshot>;
} {
  if (stack.length === 0) {
    return { popped: null, remaining: stack };
  }
  const remaining = stack.slice(0, -1);
  const popped = stack.at(-1) ?? null;
  return { popped, remaining };
}
