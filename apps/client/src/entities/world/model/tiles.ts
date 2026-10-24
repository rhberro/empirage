import type { Direction, Tile } from '@creatures/contracts/world';

/**
 * The size of one square of the grid, in world pixels.
 *
 * The whole game is drawn at this base resolution: the tile, the step and the
 * sprite feet are all measured from it, and the integer scale is applied on
 * top, never mixed into these coordinates.
 */
export const TILE_SIZE_PX = 16;

/**
 * A point in world pixels.
 */
export type Pixel = {
  x: number;
  y: number;
};

const DIRECTION_DELTA: Record<Direction, Pixel> = {
  down: { x: 0, y: 1 },
  downLeft: { x: -1, y: 1 },
  downRight: { x: 1, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  upLeft: { x: -1, y: -1 },
  upRight: { x: 1, y: -1 },
};

/**
 * The top-left pixel of a tile.
 */
export function tileToPixel(tile: Tile): Pixel {
  return { x: tile.x * TILE_SIZE_PX, y: tile.y * TILE_SIZE_PX };
}

/**
 * The tile a world pixel falls on.
 */
export function pixelToTile(pixel: Pixel): Tile {
  return {
    x: Math.floor(pixel.x / TILE_SIZE_PX),
    y: Math.floor(pixel.y / TILE_SIZE_PX),
  };
}

/**
 * The tile a container point falls on, given the letterbox, the zoom and the
 * camera.
 *
 * The point is in container CSS pixels; subtracting the letterbox lands on the
 * canvas, dividing by the zoom lands on its logical pixels, and adding the
 * camera lands on world pixels. The zoom is integer by rule, so the logical
 * point stays aligned to the grid.
 */
export function screenToTile(screen: Pixel, letterbox: Pixel, zoom: number, camera: Pixel): Tile {
  return pixelToTile({
    x: camera.x + (screen.x - letterbox.x) / zoom,
    y: camera.y + (screen.y - letterbox.y) / zoom,
  });
}

/**
 * The tile next to another in a direction.
 */
export function adjacentTile(tile: Tile, direction: Direction): Tile {
  const delta = DIRECTION_DELTA[direction];
  return { x: tile.x + delta.x, y: tile.y + delta.y };
}
