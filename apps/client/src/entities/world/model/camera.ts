import type { Pixel } from './tiles';
import { TILE_SIZE_PX } from './tiles';

/**
 * The top-left pixel of the camera, given the actor it follows and the sizes.
 *
 * The camera centers the followed point and clamps to the map, so it never
 * shows the emptiness beyond it. The result is always a whole pixel: the
 * position is floored and the bounds are integers, so the camera never moves
 * by a fraction of a pixel.
 */
export function computeCamera(followPx: Pixel, viewportPx: Pixel, worldPx: Pixel): Pixel {
  const maxX = Math.max(0, Math.floor(worldPx.x - viewportPx.x));
  const maxY = Math.max(0, Math.floor(worldPx.y - viewportPx.y));
  return {
    x: clamp(Math.floor(followPx.x - viewportPx.x / 2), 0, maxX),
    y: clamp(Math.floor(followPx.y - viewportPx.y / 2), 0, maxY),
  };
}

/**
 * A camera move that covers most of the distance each frame.
 *
 * A step of the actor changes the camera target by a whole tile; jumping there
 * in one frame is a visible snap, and one bad frame in the store becomes a
 * flicker. The camera follows the target in a few whole-pixel frames instead.
 * A jump larger than the snap distance is a teleport or a reconnect: it is
 * taken whole so the camera never travels across the map.
 */
const CAMERA_SNAP_PX = 4 * TILE_SIZE_PX;

export function smoothCamera(current: Pixel, target: Pixel, factor = 0.4): Pixel {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  if (Math.abs(dx) >= CAMERA_SNAP_PX || Math.abs(dy) >= CAMERA_SNAP_PX) {
    return { x: target.x, y: target.y };
  }
  return {
    x: current.x + stepPixels(dx, factor),
    y: current.y + stepPixels(dy, factor),
  };
}

function stepPixels(delta: number, factor: number): number {
  if (delta === 0) {
    return 0;
  }
  return Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) * factor));
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
