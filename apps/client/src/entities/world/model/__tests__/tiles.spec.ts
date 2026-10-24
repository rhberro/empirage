import { expect, test } from 'bun:test';

import { adjacentTile, pixelToTile, screenToTile, tileToPixel } from '~/entities/world/model/tiles';

/**
 * A tile names its top-left pixel: sixteen pixels per square, measured from the
 * origin.
 */
test('a tile maps to its top-left pixel', function tileMapsToPixel(): void {
  expect(tileToPixel({ x: 3, y: 4 })).toEqual({ x: 48, y: 64 });
  expect(tileToPixel({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  expect(tileToPixel({ x: -1, y: 2 })).toEqual({ x: -16, y: 32 });
});

/**
 * A pixel lands on the square that contains it, flooring the division.
 */
test('a pixel maps to the tile that contains it', function pixelMapsToTile(): void {
  expect(pixelToTile({ x: 48, y: 64 })).toEqual({ x: 3, y: 4 });
  expect(pixelToTile({ x: 63, y: 63 })).toEqual({ x: 3, y: 3 });
  expect(pixelToTile({ x: -1, y: -1 })).toEqual({ x: -1, y: -1 });
});

/**
 * A container point maps to a tile through the letterbox, the integer zoom and
 * the camera: the offset is removed, the zoom divides back to logical pixels,
 * and the camera lands on world pixels.
 */
test('a screen point maps to a tile through the zoom and letterbox', function screenMapsToTile(): void {
  expect(screenToTile({ x: 16, y: 16 }, { x: 0, y: 0 }, 1, { x: 0, y: 0 })).toEqual({ x: 1, y: 1 });
  expect(screenToTile({ x: 32, y: 32 }, { x: 0, y: 0 }, 2, { x: 0, y: 0 })).toEqual({ x: 1, y: 1 });
  expect(screenToTile({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, { x: 16, y: 32 })).toEqual({ x: 1, y: 2 });
});

/**
 * The letterbox shifts the canvas inside the container, and the zoom is the
 * factor between the CSS size and the logical size.
 */
test('the letterbox offsets the container point before the zoom', function letterboxOffsets(): void {
  expect(screenToTile({ x: 132, y: 82 }, { x: 100, y: 50 }, 2, { x: 0, y: 0 })).toEqual({
    x: 1,
    y: 1,
  });
});

/**
 * A negative letterbox crops the canvas: the visible left edge is not the
 * logical origin, and the mapping accounts for it.
 */
test('a negative letterbox maps the cropped canvas', function negativeLetterboxMaps(): void {
  expect(screenToTile({ x: 0, y: 0 }, { x: -72, y: -10 }, 1, { x: 0, y: 0 })).toEqual({
    x: 4,
    y: 0,
  });
});

/**
 * The neighbor of a tile follows the direction, including the diagonals.
 */
test('a tile has a neighbor for every direction', function tileHasNeighbor(): void {
  expect(adjacentTile({ x: 2, y: 3 }, 'up')).toEqual({ x: 2, y: 2 });
  expect(adjacentTile({ x: 2, y: 3 }, 'downRight')).toEqual({ x: 3, y: 4 });
  expect(adjacentTile({ x: 2, y: 3 }, 'left')).toEqual({ x: 1, y: 3 });
});
