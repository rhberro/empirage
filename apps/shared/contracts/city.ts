import city from './city.json';
import type { CityMap, TileId } from './world';

/**
 * The committed map keeps one row per line so a layout change reads as a
 * vertical diff; the contract is flat, so the rows are joined once on load.
 */
type CityMapSource = {
  height: number;
  name: string;
  spawn: { x: number; y: number };
  tiles: number[] | number[][];
  width: number;
};

function readCityMap(source: CityMapSource): CityMap {
  const rows = source.tiles;
  const tiles = Array.isArray(rows[0]) ? (rows as number[][]).flat() : (rows as number[]);
  if (tiles.length !== source.width * source.height) {
    throw new Error('city map has the wrong number of tiles');
  }
  return {
    height: source.height,
    name: source.name,
    spawn: source.spawn,
    tiles: tiles as TileId[],
    width: source.width,
  };
}

/**
 * The city map the whole game shares: the server judges paths by it and the
 * client paints by it. Both sides read the same bytes, so a map change is a
 * single committed diff.
 */
export const CITY_MAP: CityMap = readCityMap(city);
