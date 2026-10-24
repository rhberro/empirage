import { TILE_SIZE_PX } from './tiles';

/**
 * The fixed window of the game, in tiles.
 *
 * The city always shows exactly this window: the world inside the canvas is
 * drawn one to one, and the screen zooms by sizing the canvas up. A screen
 * that cannot fit the whole window keeps the zoom at one and crops.
 */
export const VIEW_TILES_W = 34;
export const VIEW_TILES_H = 20;

/**
 * The fixed window, in world pixels — the logical size of the canvas.
 */
export const VIEWPORT_W = VIEW_TILES_W * TILE_SIZE_PX;
export const VIEWPORT_H = VIEW_TILES_H * TILE_SIZE_PX;

/**
 * The smallest zoom the game ever uses.
 */
export const MIN_WORLD_SCALE = 1;

/**
 * The size and centering of the canvas inside its container.
 *
 * The canvas covers the container: it is at least as large on both axes,
 * centered, and the overflow is cropped away — never a bar.
 */
export type CanvasLayout = {
  canvasHeight: number;
  canvasWidth: number;
  /** The crop on the left of the canvas; negative when it overflows. */
  offsetX: number;
  /** The crop on the top of the canvas; negative when it overflows. */
  offsetY: number;
  /** The integer zoom applied to the CSS size of the canvas. */
  zoom: number;
};

/**
 * The integer zoom that covers the space given.
 *
 * The zoom is the smallest integer whose canvas covers both dimensions of the
 * container, never below one. Each axis rounds up, so the canvas is always at
 * least as large as the container: the overflow is cropped, never shown as a
 * bar. A container smaller than the window stays at one and crops instead of
 * shrinking the pixel art.
 */
export function computeWorldScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) {
    return MIN_WORLD_SCALE;
  }
  return Math.max(MIN_WORLD_SCALE, Math.ceil(width / VIEWPORT_W), Math.ceil(height / VIEWPORT_H));
}

/**
 * The CSS size and crop offset of the canvas for a container.
 *
 * The canvas is always `544×zoom` by `320×zoom` CSS pixels, centered in the
 * container. Because the zoom rounds up, the canvas covers both dimensions and
 * the offset turns negative to crop the overflow — the container only ever
 * hides the excess, never shows a bar.
 */
export function computeCanvasLayout(width: number, height: number): CanvasLayout {
  const zoom = computeWorldScale(width, height);
  const canvasWidth = VIEWPORT_W * zoom;
  const canvasHeight = VIEWPORT_H * zoom;
  return {
    canvasHeight,
    canvasWidth,
    offsetX: Math.floor((width - canvasWidth) / 2),
    offsetY: Math.floor((height - canvasHeight) / 2),
    zoom,
  };
}
