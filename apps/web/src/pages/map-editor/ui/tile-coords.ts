/* eslint-disable oxsome/no-inline-structural-types */
const TILE_SIZE = 16;
const BLOCK_WIDTH = 8;
const DEFAULT_IMAGE_HEIGHT = 1104;

export interface TileSourceCoord {
  sx: number;
  sy: number;
}

export function getTileSourceCoordinates(
  tileId: number,
  imageHeight: number = DEFAULT_IMAGE_HEIGHT,
): TileSourceCoord {
  const sheetRows = Math.floor(imageHeight / TILE_SIZE);
  const blockSize = BLOCK_WIDTH * sheetRows;
  const blockIdx = Math.floor(tileId / blockSize);
  const rem = tileId % blockSize;
  const row = Math.floor(rem / BLOCK_WIDTH);
  const colInBlock = rem % BLOCK_WIDTH;
  const col = blockIdx * BLOCK_WIDTH + colInBlock;
  return {
    sx: col * TILE_SIZE,
    sy: row * TILE_SIZE,
  };
}
