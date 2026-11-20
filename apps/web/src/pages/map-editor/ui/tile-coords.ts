/* eslint-disable oxsome/no-inline-structural-types */
const TILE_SIZE = 16;
const SHEET_COLS = 8;

export interface TileSourceCoord {
  sx: number;
  sy: number;
}

export function getTileSourceCoordinates(tileId: number, _imageHeight?: number): TileSourceCoord {
  const col = tileId % SHEET_COLS;
  const row = Math.floor(tileId / SHEET_COLS);
  return {
    sx: col * TILE_SIZE,
    sy: row * TILE_SIZE,
  };
}
