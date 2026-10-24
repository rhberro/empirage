import { Application, CullerPlugin, extensions } from 'pixi.js';

/**
 * The color behind the world, matching `bg.sunken` of the theme.
 *
 * The canvas can be a few pixels wider than the world at the map edges, and
 * those pixels show this instead of the page.
 */
export const WORLD_BACKGROUND = 0x070a0d;

// The hunt keeps 24 creatures and their bars on a 96×64 map while the camera
// shows a small slice; culling lets Pixi skip the ones outside the viewport.
extensions.add(CullerPlugin);

/**
 * A Pixi application configured for the pixel-art world.
 *
 * `resolution` stays at one and antialiasing is off so the art is never
 * resampled; `roundPixels` is a safety net, never the source of the integers.
 * The canvas keeps a fixed logical size (544×320) and its CSS size is managed
 * by the scene, so the renderer never sizes the canvas by itself.
 */
export function createPixiApp(): Promise<Application> {
  const app = new Application();
  return app
    .init({
      antialias: false,
      autoDensity: false,
      backgroundColor: WORLD_BACKGROUND,
      preference: 'webgl',
      resolution: 1,
      roundPixels: true,
    })
    .then(function ready(): Application {
      // 120 leaves room for a 60 Hz display without the Ticker skipping every
      // other frame, and still caps a 144 Hz display at a sane rate.
      app.ticker.maxFPS = 120;
      return app;
    });
}

/**
 * Tears the application down and removes its canvas from the DOM.
 *
 * The stage children are destroyed but their textures are left alone: they are
 * shared with the assets cache, and a StrictMode remount reuses them instead
 * of loading them again.
 */
export function destroyPixiApp(app: Application): void {
  // `releaseGlobalResources` clears the global pools (batches, textures) that
  // the renderer caches. Without it, a fresh Application created right after
  // (StrictMode remount, HMR, city↔hunt) reuses stale pooled objects and can
  // render a corrupted, all-black frame.
  app.destroy({ releaseGlobalResources: true, removeView: true }, { children: true });
}
