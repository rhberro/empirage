/* eslint-disable oxsome/no-inline-structural-types */
export interface HuntingLocationMapTile {
  animationId?: string | null;
  frame: number;
  x: number;
  y: number;
}

export interface HuntingLocationSpecialTile {
  kind: 'blocked' | 'creature_spawn' | 'enemy_spawn' | 'trainer_spawn';
  x: number;
  y: number;
}

export interface HuntingLocationAnimation {
  delayBetweenRunsMs?: number;
  frameRateMs: number;
  frames: Array<number>;
  id: string;
  iterations: number;
  mode: 'loop' | 'pingpong';
}

export interface HuntingLocationMapObject {
  kind: string;
  x: number;
  y: number;
}

export interface HuntingLocationMapLayer {
  id: string;
  name: string;
  order: number;
  placement: 'above_characters' | 'below_characters';
  tiles: Array<HuntingLocationMapTile>;
  visible?: boolean;
}

export interface HuntingLocationMap {
  animations?: Array<HuntingLocationAnimation>;
  defaultTileFrame: number;
  height: number;
  layers?: Array<HuntingLocationMapLayer>;
  objects?: Array<HuntingLocationMapObject>;
  specialTiles?: Array<HuntingLocationSpecialTile>;
  tileSize: number;
  tiles: Array<HuntingLocationMapTile>;
  width: number;
}

export interface HuntingLocationSpecies {
  description: string;
  encounterWeight: number;
  id: number;
  maximumLevel: number;
  minimumLevel: number;
  name: string;
  slot: number;
}

export type HuntingLocationSpeciesList = Array<HuntingLocationSpecies>;

export interface HuntingLocationWaveRange {
  maximumSize: number;
  minimumSize: number;
}

export type HuntingLocationWaveRangeList = Array<HuntingLocationWaveRange>;

export interface SpeciesCatalogItem {
  description: string;
  id: number;
  name: string;
}

export interface UpdateHuntingLocationSpeciesInput {
  encounterWeight: number;
  maximumLevel: number;
  minimumLevel: number;
  slot: number;
  speciesId: number;
}

export interface UpdateHuntingLocationWaveRangeInput {
  maximumSize: number;
  minimumSize: number;
}

export interface CreateHuntingLocationInput {
  description: string;
  mapData: HuntingLocationMap;
  name: string;
  slug: string;
  speciesList?: Array<UpdateHuntingLocationSpeciesInput>;
  tilesetUrl?: string;
  waveRangesList?: Array<UpdateHuntingLocationWaveRangeInput>;
}

export interface HuntingLocation {
  description: string;
  id: number;
  map: HuntingLocationMap;
  name: string;
  positionX: number;
  positionY: number;
  slug: string;
  species: HuntingLocationSpeciesList;
  tilesetUrl: string;
  waveRanges: HuntingLocationWaveRangeList;
}
