/* eslint-disable oxc/no-optional-chaining, react-hooks/exhaustive-deps, oxsome/no-inline-functions-objects-arrays */
import { AUTO, Game, Scale } from 'phaser';
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import { authStore } from '~/shared/auth';
import { getSelectedCharacter } from '~/shared/session';

import type { HuntCommand } from '../api/hunt-protocol';
import type { HuntingLocation } from '../api/hunting-locations';
import { CityScene } from './CityScene';

const GAME_WIDTH = 480;
const GAME_HEIGHT = 288;
type Cleanup = () => void;
type HuntCommandSenderChangeHandler = (
  sender: ((command: HuntCommand) => boolean) | undefined,
) => void;
type TransitionChangeHandler = (active: boolean, message: string) => void;
type GameReadyHandler = () => void;
type GameCanvasProps = {
  huntingLocations: Array<HuntingLocation>;
  onHuntCommandSenderChange: HuntCommandSenderChangeHandler;
  onGameReady: GameReadyHandler;
  onTransitionChange: TransitionChangeHandler;
};

export function GameCanvas(props: GameCanvasProps): ReactElement {
  const { huntingLocations, onHuntCommandSenderChange, onGameReady, onTransitionChange } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const onHuntCommandSenderChangeRef = useRef(onHuntCommandSenderChange);
  const onTransitionChangeRef = useRef(onTransitionChange);
  const onGameReadyRef = useRef(onGameReady);
  const sceneRef = useRef<CityScene | null>(null);

  function synchronizeHandlers(): void {
    onHuntCommandSenderChangeRef.current = onHuntCommandSenderChange;
    onTransitionChangeRef.current = onTransitionChange;
    onGameReadyRef.current = onGameReady;
  }

  function handleGameReady(): void {
    onGameReadyRef.current();
  }

  function handleTransitionChange(active: boolean, message: string): void {
    onTransitionChangeRef.current(active, message);
  }

  function mountGame(): Cleanup | undefined {
    const container = containerRef.current;
    const session = authStore.getState().session;
    const characterId = session ? getSelectedCharacter(session.user.id) : null;
    if (!container || !characterId) {
      return;
    }
    const scene = new CityScene(
      characterId,
      onHuntCommandSenderChangeRef.current,
      handleTransitionChange,
      handleGameReady,
    );
    sceneRef.current = scene;
    const config = {
      antialias: false,
      backgroundColor: '#77777f',
      dom: { createContainer: true, pointerEvents: 'none' },
      height: GAME_HEIGHT,
      parent: container,
      pixelArt: true,
      render: { antialias: false, roundPixels: true },
      roundPixels: true,
      scale: {
        autoCenter: Scale.CENTER_BOTH,
        height: GAME_HEIGHT,
        mode: Scale.ENVELOP,
        width: GAME_WIDTH,
      },
      scene,
      type: AUTO,
      width: GAME_WIDTH,
    };
    const game = new Game(config);
    function unmountGame(): void {
      sceneRef.current = null;
      game.destroy(true);
    }
    return unmountGame;
  }

  useEffect(synchronizeHandlers, [onHuntCommandSenderChange, onGameReady, onTransitionChange]);
  useEffect(mountGame, []);
  useEffect(
    function synchronizeHuntingLocations(): void {
      sceneRef.current?.setHuntingLocations(huntingLocations);
    },
    [huntingLocations],
  );
  return <div className="game-canvas" ref={containerRef} />;
}
