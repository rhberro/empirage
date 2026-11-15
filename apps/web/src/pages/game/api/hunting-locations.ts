/* eslint-disable oxsome/no-inline-structural-types */
import { apiRequest } from '~/shared/api';

export type HuntingLocationMap = {
  defaultTileFrame: number;
  height: number;
  objects: Array<HuntingLocationMapObject>;
  tileSize: number;
  tiles: Array<HuntingLocationMapTile>;
  width: number;
};
export type HuntingLocationMapObject = { kind: string; x: number; y: number };
export type HuntingLocationMapTile = { frame: number; x: number; y: number };
export type HuntingLocationSpecies = {
  description: string;
  encounterWeight: number;
  id: number;
  maximumLevel: number;
  minimumLevel: number;
  name: string;
};
export type HuntingLocationWaveRange = { maximumSize: number; minimumSize: number };
export type HuntingLocation = {
  description: string;
  id: number;
  map: HuntingLocationMap;
  name: string;
  positionX: number;
  positionY: number;
  slug: string;
  species: Array<HuntingLocationSpecies>;
  tilesetUrl: string;
  waveRanges: Array<HuntingLocationWaveRange>;
};

export function getHuntingLocations(): Promise<Array<HuntingLocation>> {
  return apiRequest<Array<HuntingLocation>>('/hunting-locations');
}
