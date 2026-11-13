import { AUTO, Game, Scale } from 'phaser';
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import { authStore } from '~/shared/auth';
import { getSelectedCharacter } from '~/shared/session';

import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import { CityScene } from './CityScene';

const GAME_WIDTH = 480;
const GAME_HEIGHT = 288;
type Cleanup = () => void;
type HuntStateChangeHandler = (hunt: HuntState | null) => void;
type HuntCommandSenderChangeHandler = (
  sender: ((command: HuntCommand) => boolean) | undefined,
) => void;
type GameCanvasProps = {
  onHuntCommandSenderChange: HuntCommandSenderChangeHandler;
  onHuntStateChange: HuntStateChangeHandler;
};

export function GameCanvas(props: GameCanvasProps): ReactElement {
  const { onHuntCommandSenderChange, onHuntStateChange } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const onHuntCommandSenderChangeRef = useRef(onHuntCommandSenderChange);
  const onHuntStateChangeRef = useRef(onHuntStateChange);

  function synchronizeHuntStateHandler(): void {
    onHuntStateChangeRef.current = onHuntStateChange;
    onHuntCommandSenderChangeRef.current = onHuntCommandSenderChange;
  }

  function handleHuntStateChange(hunt: HuntState | null): void {
    onHuntStateChangeRef.current(hunt);
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
      handleHuntStateChange,
      onHuntCommandSenderChangeRef.current,
    );
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
      game.destroy(true);
    }
    return unmountGame;
  }

  useEffect(synchronizeHuntStateHandler, [onHuntCommandSenderChange, onHuntStateChange]);
  useEffect(mountGame, []);
  return <div className="game-canvas" ref={containerRef} />;
}
