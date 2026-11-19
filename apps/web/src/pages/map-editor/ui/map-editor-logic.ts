/* eslint-disable oxsome/no-inline-structural-types */
import {
  getHuntingLocations,
  updateHuntingLocationMap,
  type HuntingLocation,
  type HuntingLocationAnimation,
  type HuntingLocationMap,
  type HuntingLocationMapTile,
  type HuntingLocationSpecialTile,
  type HuntingLocationSpecies,
  type HuntingLocationWaveRange,
  type UpdateHuntingLocationMapPayload,
  type UpdateHuntingLocationSpeciesPayload,
} from '~/entities/hunting-location';

import type { BrushType, EditorTool, MapSnapshot, SpecialCounts, StatusMessage } from './types';

export const AVAILABLE_TILESETS = [
  { id: 'exterior', name: 'Exterior (Cidades, Florestas)', url: '/assets/tilesets/exterior.png' },
  { id: 'exterior2', name: 'Exterior 2', url: '/assets/tilesets/exterior2.png' },
];

export const MAX_HISTORY_LENGTH = 25;
export const VIEWPORT_GRID_WIDTH = 30;
export const VIEWPORT_GRID_HEIGHT = 18;

export const DEFAULT_SPECIALS: Array<HuntingLocationSpecialTile> = [
  { kind: 'trainer_spawn', x: 2, y: 3 },
  { kind: 'creature_spawn', x: 6, y: 3 },
  { kind: 'blocked', x: 4, y: 2 },
  { kind: 'enemy_spawn', x: 9, y: 3 },
];

export const INITIAL_LOCATIONS: Array<HuntingLocation> = [];
export const INITIAL_TILES: Array<HuntingLocationMapTile> = [];
export const INITIAL_SPECIALS: Array<HuntingLocationSpecialTile> = [];
export const INITIAL_ANIMS: Array<HuntingLocationAnimation> = [];
export const INITIAL_CONFIGURED_SPECIES: Array<HuntingLocationSpecies> = [];
export const INITIAL_CONFIGURED_WAVE_RANGES: Array<HuntingLocationWaveRange> = [];
export const INITIAL_TOOL: EditorTool = { frame: 0, kind: 'tile' };
export const INITIAL_BRUSH: BrushType = 'pencil';
export const EMPTY_TILES_LIST: Array<HuntingLocationMapTile> = [];
export const EMPTY_SNAPSHOT_STACK: Array<MapSnapshot> = [];

export const MSG_LOAD_FAIL: StatusMessage = {
  text: 'Falha ao carregar locais de caça.',
  type: 'error',
};

export const MSG_VALIDATION_FAIL: StatusMessage = {
  text: 'Não é possível salvar: o mapa precisa de pelo menos 1 de cada tile especial (Blocked, Enemy Spawn, Trainer Spawn e Creature Spawn).',
  type: 'error',
};

export const MSG_SAVE_SUCCESS: StatusMessage = {
  text: 'Mapa salvo com sucesso no banco de dados!',
  type: 'success',
};

export const MSG_SAVE_ERROR: StatusMessage = {
  text: 'Erro ao salvar mapa no servidor.',
  type: 'error',
};

export const MSG_CLEAR_SUCCESS: StatusMessage = {
  text: 'Mapa limpo e resetado para o tamanho padrão do viewport (30x18)!',
  type: 'success',
};

export function toggleBoolean(value: boolean): boolean {
  return !value;
}

export function computeSpecialCounts(
  specialTiles: Array<HuntingLocationSpecialTile>,
): SpecialCounts {
  let blocked = 0;
  let enemySpawn = 0;
  let trainerSpawn = 0;
  let creatureSpawn = 0;

  for (const s of specialTiles) {
    if (s.kind === 'blocked') {
      blocked += 1;
    } else if (s.kind === 'enemy_spawn') {
      enemySpawn += 1;
    } else if (s.kind === 'trainer_spawn') {
      trainerSpawn += 1;
    } else if (s.kind === 'creature_spawn') {
      creatureSpawn += 1;
    }
  }

  return {
    blocked,
    canSave: blocked >= 1 && enemySpawn >= 1 && trainerSpawn >= 1 && creatureSpawn >= 1,
    creatureSpawn,
    enemySpawn,
    trainerSpawn,
  };
}

function mapSpeciesPayloadItem(sp: HuntingLocationSpecies): UpdateHuntingLocationSpeciesPayload {
  return {
    encounterWeight: sp.encounterWeight,
    maximumLevel: sp.maximumLevel,
    minimumLevel: sp.minimumLevel,
    slot: sp.slot ?? 1,
    speciesId: sp.id,
  };
}

export function cropMapTiles(map: HuntingLocationMap): HuntingLocationMap {
  const width = map.width;
  const height = map.height;

  function isTileInside(tile: HuntingLocationMapTile): boolean {
    return tile.x >= 0 && tile.x < width && tile.y >= 0 && tile.y < height;
  }

  function isSpecialInside(special: HuntingLocationSpecialTile): boolean {
    return special.x >= 0 && special.x < width && special.y >= 0 && special.y < height;
  }

  const croppedTiles = map.tiles.filter(isTileInside);
  const croppedSpecial = map.specialTiles ? map.specialTiles.filter(isSpecialInside) : undefined;

  return {
    ...map,
    specialTiles: croppedSpecial,
    tiles: croppedTiles,
  };
}

export function persistMap(
  locationId: number,
  mapPayload: HuntingLocationMap,
  tilesetUrl: string,
  speciesList?: Array<HuntingLocationSpecies>,
  waveRangeList?: Array<HuntingLocationWaveRange>,
): Promise<HuntingLocation> {
  const croppedMap = cropMapTiles(mapPayload);
  const speciesPayload = speciesList ? speciesList.map(mapSpeciesPayloadItem) : undefined;

  const updateData: UpdateHuntingLocationMapPayload = {
    map: croppedMap,
    species: speciesPayload,
    tilesetUrl,
    waveRanges: waveRangeList,
  };
  return updateHuntingLocationMap(locationId, updateData);
}

export function replaceLocationInList(
  list: Array<HuntingLocation>,
  updated: HuntingLocation,
): Array<HuntingLocation> {
  function mapLoc(l: HuntingLocation): HuntingLocation {
    return l.id === updated.id ? updated : l;
  }
  return list.map(mapLoc);
}

export function makeLocationUpdater(
  updated: HuntingLocation,
): (prev: Array<HuntingLocation>) => Array<HuntingLocation> {
  function updater(prev: Array<HuntingLocation>): Array<HuntingLocation> {
    return replaceLocationInList(prev, updated);
  }
  return updater;
}

export function fetchLocationsList(): Promise<Array<HuntingLocation>> {
  return getHuntingLocations();
}

export function pushSnapshotToStack(
  stack: Array<MapSnapshot>,
  snapshot: MapSnapshot,
): Array<MapSnapshot> {
  const trimmed = stack.slice(-MAX_HISTORY_LENGTH + 1);
  return [...trimmed, snapshot];
}

export function popSnapshotFromStack(stack: Array<MapSnapshot>): {
  popped: MapSnapshot | null;
  remaining: Array<MapSnapshot>;
} {
  if (stack.length === 0) {
    return { popped: null, remaining: stack };
  }
  const remaining = stack.slice(0, -1);
  const popped = stack.at(-1);
  return { popped, remaining };
}

export function applySnapshotValues(
  snap: MapSnapshot,
  setW: (w: number) => void,
  setH: (h: number) => void,
  setT: (t: Array<HuntingLocationMapTile>) => void,
  setS: (s: Array<HuntingLocationSpecialTile>) => void,
): void {
  setW(snap.width);
  setH(snap.height);
  setT(snap.tiles);
  setS(snap.specialTiles);
}
