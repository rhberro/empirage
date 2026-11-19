/* eslint-disable oxsome/no-inline-structural-types */
import { useState } from 'react';

import {
  captureMapSnapshot,
  EMPTY_SNAPSHOT_STACK,
  popSnapshotFromStack,
  pushSnapshotToStack,
} from './map-history-logic';
import type { HuntingLocationMapTile, HuntingLocationSpecialTile, MapSnapshot } from './types';
import { useHistoryKeyboardShortcuts } from './use-history-keyboard';

export interface EditorHistory {
  canRedo: boolean;
  canUndo: boolean;
  clearHistory: () => void;
  handleRedo: () => void;
  handleUndo: () => void;
  pushHistorySnapshot: () => void;
}

export interface HistorySetters {
  setMapHeight: (h: number) => void;
  setMapWidth: (w: number) => void;
  setSpecialTiles: (s: Array<HuntingLocationSpecialTile>) => void;
  setTiles: (t: Array<HuntingLocationMapTile>) => void;
}

export interface HistoryState {
  mapHeight: number;
  mapWidth: number;
  specialTiles: Array<HuntingLocationSpecialTile>;
  tiles: Array<HuntingLocationMapTile>;
}

function applySnapshot(snap: MapSnapshot, setters: HistorySetters): void {
  setters.setMapWidth(snap.width);
  setters.setMapHeight(snap.height);
  setters.setTiles(snap.tiles);
  setters.setSpecialTiles(snap.specialTiles);
}

function performUndo(
  undoStack: Array<MapSnapshot>,
  state: HistoryState,
  setters: HistorySetters,
  setUndo: React.Dispatch<React.SetStateAction<Array<MapSnapshot>>>,
  setRedo: React.Dispatch<React.SetStateAction<Array<MapSnapshot>>>,
): void {
  const { popped: previous, remaining: newUndo } = popSnapshotFromStack(undoStack);
  if (!previous) {
    return;
  }
  const currentSnap = captureMapSnapshot(
    state.mapWidth,
    state.mapHeight,
    state.tiles,
    state.specialTiles,
  );
  function updateRedo(prev: Array<MapSnapshot>): Array<MapSnapshot> {
    return [...prev, currentSnap];
  }
  setRedo(updateRedo);
  setUndo(newUndo);
  applySnapshot(previous, setters);
}

function performRedo(
  redoStack: Array<MapSnapshot>,
  state: HistoryState,
  setters: HistorySetters,
  setUndo: React.Dispatch<React.SetStateAction<Array<MapSnapshot>>>,
  setRedo: React.Dispatch<React.SetStateAction<Array<MapSnapshot>>>,
): void {
  const { popped: next, remaining: newRedo } = popSnapshotFromStack(redoStack);
  if (!next) {
    return;
  }
  const currentSnap = captureMapSnapshot(
    state.mapWidth,
    state.mapHeight,
    state.tiles,
    state.specialTiles,
  );
  function updateUndo(prev: Array<MapSnapshot>): Array<MapSnapshot> {
    return [...prev, currentSnap];
  }
  setUndo(updateUndo);
  setRedo(newRedo);
  applySnapshot(next, setters);
}

export function useEditorHistory(state: HistoryState, setters: HistorySetters): EditorHistory {
  const [undoStack, setUndoStack] = useState<Array<MapSnapshot>>(EMPTY_SNAPSHOT_STACK);
  const [redoStack, setRedoStack] = useState<Array<MapSnapshot>>(EMPTY_SNAPSHOT_STACK);

  function pushHistorySnapshot(): void {
    const snap = captureMapSnapshot(
      state.mapWidth,
      state.mapHeight,
      state.tiles,
      state.specialTiles,
    );
    function updateUndo(prev: Array<MapSnapshot>): Array<MapSnapshot> {
      return pushSnapshotToStack(prev, snap);
    }
    setUndoStack(updateUndo);
    setRedoStack(EMPTY_SNAPSHOT_STACK);
  }

  function handleUndo(): void {
    performUndo(undoStack, state, setters, setUndoStack, setRedoStack);
  }

  function handleRedo(): void {
    performRedo(redoStack, state, setters, setUndoStack, setRedoStack);
  }

  function clearHistory(): void {
    setUndoStack(EMPTY_SNAPSHOT_STACK);
    setRedoStack(EMPTY_SNAPSHOT_STACK);
  }

  useHistoryKeyboardShortcuts(handleUndo, handleRedo);

  return {
    canRedo: redoStack.length > 0,
    canUndo: undoStack.length > 0,
    clearHistory,
    handleRedo,
    handleUndo,
    pushHistorySnapshot,
  };
}
