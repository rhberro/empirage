import { AUTO, Game, Scale, Scene } from 'phaser';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

const GAME_WIDTH = 320;
const GAME_HEIGHT = 180;
type Cleanup = () => void;

class GameScene extends Scene {
  public constructor() {
    super('GameScene');
  }

  public create(): void {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Empirage', {
      color: '#f4e8c1',
      fontFamily: 'monospace',
      fontSize: '16px',
    });
    text.setOrigin(0.5);
  }
}

export function GameCanvas(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [initializationError, setInitializationError] = useState<Error | null>(null);

  function mountGame(): Cleanup | undefined {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const config = {
      antialias: false,
      backgroundColor: '#17151f',
      height: GAME_HEIGHT,
      parent: container,
      pixelArt: true,
      render: {
        antialias: false,
        roundPixels: true,
      },
      roundPixels: true,
      scale: {
        autoCenter: Scale.CENTER_BOTH,
        height: GAME_HEIGHT,
        mode: Scale.FIT,
        width: GAME_WIDTH,
      },
      scene: GameScene,
      type: AUTO,
      width: GAME_WIDTH,
    };
    const lifecycle = { disposed: false };

    function handleInitializationError(error: unknown): void {
      if (!lifecycle.disposed) {
        const failure =
          error instanceof Error ? error : new Error('Unable to initialize the game canvas.');
        setInitializationError(failure);
      }
    }

    let game: Game;

    try {
      game = new Game(config);
    } catch (error) {
      handleInitializationError(error);
      return;
    }

    function unmountGame(): void {
      lifecycle.disposed = true;
      game.destroy(true);
    }

    return unmountGame;
  }

  useEffect(mountGame, []);

  if (initializationError) {
    throw initializationError;
  }

  return <div className="game-canvas" ref={containerRef} />;
}
