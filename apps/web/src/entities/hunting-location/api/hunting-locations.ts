/* eslint-disable oxsome/no-inline-structural-types */
import { apiRequest } from '~/shared/api';

export type HuntingLocationSpecialTileKind =
  | 'blocked'
  | 'creature_spawn'
  | 'enemy_spawn'
  | 'trainer_spawn';

export type HuntingLocationSpecialTile = {
  kind: HuntingLocationSpecialTileKind;
  x: number;
  y: number;
};

export type HuntingLocationAnimation = {
  frameRateMs: number;
  frames: Array<number>;
  id: string;
  iterations: number;
  mode: 'loop' | 'pingpong';
};

export type HuntingLocationMapTile = {
  animationId?: string | null;
  frame: number;
  x: number;
  y: number;
};

export type HuntingLocationMapObject = { kind: string; x: number; y: number };

export type HuntingLocationMap = {
  animations?: Array<HuntingLocationAnimation>;
  defaultTileFrame: number;
  height: number;
  objects?: Array<HuntingLocationMapObject>;
  specialTiles?: Array<HuntingLocationSpecialTile>;
  tileSize: number;
  tiles: Array<HuntingLocationMapTile>;
  width: number;
};

export type HuntingLocationSpecies = {
  description: string;
  encounterWeight: number;
  id: number;
  maximumLevel: number;
  minimumLevel: number;
  name: string;
  slot?: number;
};

export type SpeciesCatalogItem = {
  description: string;
  id: number;
  name: string;
};

export type UpdateHuntingLocationSpeciesPayload = {
  encounterWeight: number;
  maximumLevel: number;
  minimumLevel: number;
  slot: number;
  speciesId: number;
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

export interface UpdateHuntingLocationMapPayload {
  map: HuntingLocationMap;
  species?: Array<UpdateHuntingLocationSpeciesPayload>;
  tilesetUrl?: string;
  waveRanges?: Array<HuntingLocationWaveRange>;
}

export interface CreateHuntingLocationPayload {
  description?: string;
  map?: HuntingLocationMap;
  name: string;
  slug: string;
  species?: Array<UpdateHuntingLocationSpeciesPayload>;
  tilesetUrl?: string;
  waveRanges?: Array<HuntingLocationWaveRange>;
}

export function getHuntingLocations(): Promise<Array<HuntingLocation>> {
  return apiRequest<Array<HuntingLocation>>('/hunting-locations');
}

export function getSpeciesCatalog(): Promise<Array<SpeciesCatalogItem>> {
  return apiRequest<Array<SpeciesCatalogItem>>('/hunting-locations/species');
}

export function createHuntingLocation(
  payload: CreateHuntingLocationPayload,
): Promise<HuntingLocation> {
  const options = {
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  };
  return apiRequest<HuntingLocation>('/hunting-locations', options);
}

export function updateHuntingLocationMap(
  locationId: number,
  payload: UpdateHuntingLocationMapPayload,
): Promise<HuntingLocation> {
  const options = {
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  };
  return apiRequest<HuntingLocation>(`/hunting-locations/${locationId}/map`, options);
}
