/* eslint-disable oxsome/no-inline-structural-types */
import { useEffect } from 'react';

type KeyHandler = () => void;

export function useHistoryKeyboardShortcuts(onUndo: KeyHandler, onRedo: KeyHandler): void {
  function handleKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      onUndo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      onRedo();
    }
  }

  function bindKeys(): () => void {
    globalThis.addEventListener('keydown', handleKeyDown);
    function unbind(): void {
      globalThis.removeEventListener('keydown', handleKeyDown);
    }
    return unbind;
  }

  useEffect(bindKeys);
}
