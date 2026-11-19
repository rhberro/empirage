/* eslint-disable oxsome/no-inline-structural-types */
import type {
  CreateHuntingLocationPayload,
  HuntingLocation,
  HuntingLocationAnimation,
  HuntingLocationMap,
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
  HuntingLocationSpecies,
  HuntingLocationWaveRange,
  SpeciesCatalogItem,
  UpdateHuntingLocationMapPayload,
  UpdateHuntingLocationSpeciesPayload,
} from '~/entities/hunting-location';

export type {
  CreateHuntingLocationPayload,
  HuntingLocation,
  HuntingLocationAnimation,
  HuntingLocationMap,
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
  HuntingLocationSpecies,
  HuntingLocationWaveRange,
  SpeciesCatalogItem,
  UpdateHuntingLocationMapPayload,
  UpdateHuntingLocationSpeciesPayload,
};

export type BrushType = 'bucket' | 'pencil' | 'rect' | 'select';

export interface StampTile {
  animationId?: string | null;
  frame: number;
  relX: number;
  relY: number;
}

export type EditorTool =
  | { kind: 'eraser' }
  | { kind: 'special'; specialKind: 'blocked' | 'creature_spawn' | 'enemy_spawn' | 'trainer_spawn' }
  | { animationId?: string | null; frame: number; kind: 'tile' }
  | { height: number; kind: 'stamp'; tiles: Array<StampTile>; width: number };

export interface StatusMessage {
  text: string;
  type: 'error' | 'success';
}

export interface MapSnapshot {
  height: number;
  specialTiles: Array<HuntingLocationSpecialTile>;
  tiles: Array<HuntingLocationMapTile>;
  width: number;
}

export const MAX_HISTORY_LENGTH = 25;

export interface SpecialCounts {
  blocked: number;
  canSave: boolean;
  creatureSpawn: number;
  enemySpawn: number;
  trainerSpawn: number;
}

export interface MapStateBundle {
  animations: Array<HuntingLocationAnimation>;
  defaultTileFrame: number;
  mapHeight: number;
  mapWidth: number;
  specialTiles: Array<HuntingLocationSpecialTile>;
  tileSize: number;
  tiles: Array<HuntingLocationMapTile>;
}
