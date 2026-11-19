/* eslint-disable oxsome/no-inline-structural-types */
import { useState } from 'react';

import {
  createHuntingLocation,
  type CreateHuntingLocationPayload,
  type HuntingLocation,
  type HuntingLocationMap,
} from '~/entities/hunting-location';

import { DEFAULT_SPECIALS } from './map-editor-logic';

export interface UseCreateLocationParams {
  applyLocationMap: (loc: HuntingLocation) => void;
  mapHeight: number;
  mapWidth: number;
  selectedTilesetUrl: string;
  setLocations: React.Dispatch<React.SetStateAction<Array<HuntingLocation>>>;
  setSelectedLocationId: (id: number) => void;
}

export interface UseCreateLocationResult {
  handleCloseCreateLocationModal: () => void;
  handleCreateLocation: (payload: CreateHuntingLocationPayload) => Promise<void>;
  handleOpenCreateLocationModal: () => void;
  isCreateLocationModalOpen: boolean;
  isCreatingLocation: boolean;
}

function buildInitialMap(width: number, height: number): HuntingLocationMap {
  return {
    animations: [],
    defaultTileFrame: 0,
    height,
    specialTiles: Array.from(DEFAULT_SPECIALS),
    tileSize: 16,
    tiles: [],
    width,
  };
}

function makeAppendLocation(
  created: HuntingLocation,
): (prev: Array<HuntingLocation>) => Array<HuntingLocation> {
  function append(prev: Array<HuntingLocation>): Array<HuntingLocation> {
    return [...prev, created];
  }
  return append;
}

export function useCreateLocation(params: UseCreateLocationParams): UseCreateLocationResult {
  const {
    applyLocationMap,
    mapHeight,
    mapWidth,
    selectedTilesetUrl,
    setLocations,
    setSelectedLocationId,
  } = params;
  const [isCreateLocationModalOpen, setIsCreateLocationModalOpen] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);

  function handleOpenCreateLocationModal(): void {
    setIsCreateLocationModalOpen(true);
  }

  function handleCloseCreateLocationModal(): void {
    setIsCreateLocationModalOpen(false);
  }

  async function handleCreateLocation(payload: CreateHuntingLocationPayload): Promise<void> {
    setIsCreatingLocation(true);
    try {
      const initialMap = buildInitialMap(mapWidth, mapHeight);
      const createPayload = {
        ...payload,
        map: initialMap,
        tilesetUrl: selectedTilesetUrl,
      };
      const created = await createHuntingLocation(createPayload);
      setLocations(makeAppendLocation(created));
      setSelectedLocationId(created.id);
      applyLocationMap(created);
      setIsCreateLocationModalOpen(false);
      setIsCreatingLocation(false);
    } catch (err) {
      setIsCreatingLocation(false);
      throw err;
    }
  }

  return {
    handleCloseCreateLocationModal,
    handleCreateLocation,
    handleOpenCreateLocationModal,
    isCreateLocationModalOpen,
    isCreatingLocation,
  };
}
