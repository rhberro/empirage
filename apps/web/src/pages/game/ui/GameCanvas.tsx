import { Application } from 'pixi.js';
import type { Destructor, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

export function GameCanvas(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [initializationError, setInitializationError] = useState<Error | null>(null);

  function mountCanvas(): Destructor | undefined {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const app = new Application();
    const lifecycle = { disposed: false, initialized: false };

    async function initialize(): Promise<void> {
      const options = {
        autoDensity: true,
        resizeTo: container,
        resolution: globalThis.devicePixelRatio || 1,
      };

      await app.init(options);
      lifecycle.initialized = true;

      // Initialization can finish after React has already cleaned up this effect.
      if (lifecycle.disposed) {
        app.destroy(true, { children: true });
        return;
      }

      container.append(app.canvas);
    }

    function handleInitializationError(error: unknown): void {
      if (!lifecycle.disposed) {
        const failure =
          error instanceof Error ? error : new Error('Unable to initialize the game canvas.');
        setInitializationError(failure);
      }
    }

    initialize().catch(handleInitializationError);

    function unmountCanvas(): void {
      lifecycle.disposed = true;

      if (lifecycle.initialized) {
        app.destroy(true, { children: true });
      }
    }

    return unmountCanvas;
  }

  useEffect(mountCanvas, []);

  if (initializationError) {
    throw initializationError;
  }

  return <div className="game-canvas" ref={containerRef} />;
}
