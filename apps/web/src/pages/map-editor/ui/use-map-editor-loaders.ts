/* eslint-disable oxsome/no-inline-structural-types */
import { useCallback, useEffect, useState } from 'react';

import {
  fetchLocationsList,
  INITIAL_LOCATIONS,
  MSG_LOAD_FAIL,
  toggleBoolean,
  type HuntingLocation,
  type StatusMessage,
} from './map-editor-logic';
import { useSpeciesCatalog } from './use-species-catalog';

export { useSpeciesCatalog };

export function useTilesetImage(
  tilesetUrl: string = '/assets/tilesets/exterior.png',
): HTMLImageElement | null {
  const [tilesetImage, setTilesetImage] = useState<HTMLImageElement | null>(null);

  function loadTileset(): () => void {
    const img = new globalThis.Image();
    img.src = tilesetUrl;
    function handleLoad(): void {
      setTilesetImage(img);
    }
    img.addEventListener('load', handleLoad);
    function cleanup(): void {
      img.removeEventListener('load', handleLoad);
    }
    return cleanup;
  }

  useEffect(loadTileset, [tilesetUrl]);

  return tilesetImage;
}

interface LocationsLoader {
  loading: boolean;
  locations: Array<HuntingLocation>;
  setLocations: React.Dispatch<React.SetStateAction<Array<HuntingLocation>>>;
}

export function useLocationsLoader(
  onFirstLocation: (first: HuntingLocation) => void,
  setStatusMessage: (msg: StatusMessage | null) => void,
): LocationsLoader {
  const [locations, setLocations] = useState<Array<HuntingLocation>>(INITIAL_LOCATIONS);
  const [loading, setLoading] = useState(true);

  function handleListCallback(list: Array<HuntingLocation>): void {
    setLocations(list);
    if (list.length > 0) {
      onFirstLocation(list[0]);
    }
    setLoading(false);
  }
  const handleList = useCallback(handleListCallback, [onFirstLocation]);

  function handleErrorCallback(): void {
    setStatusMessage(MSG_LOAD_FAIL);
    setLoading(false);
  }
  const handleError = useCallback(handleErrorCallback, [setStatusMessage]);

  function loadLocationsEffect(): void {
    const promise = fetchLocationsList();
    promise.then(handleList).catch(handleError);
  }

  useEffect(loadLocationsEffect, [handleError, handleList]);

  return { loading, locations, setLocations };
}

export interface EditorVisibilityToggles {
  handleToggleGrid: () => void;
  handleToggleSpecials: () => void;
  handleToggleViewport: () => void;
  showGridLines: boolean;
  showSpecialTiles: boolean;
  showViewportOverlay: boolean;
}

export function useEditorVisibilityToggles(): EditorVisibilityToggles {
  const [showGridLines, setShowGridLines] = useState(true);
  const [showSpecialTiles, setShowSpecialTiles] = useState(true);
  const [showViewportOverlay, setShowViewportOverlay] = useState(true);

  function handleToggleGrid(): void {
    setShowGridLines(toggleBoolean);
  }

  function handleToggleSpecials(): void {
    setShowSpecialTiles(toggleBoolean);
  }

  function handleToggleViewport(): void {
    setShowViewportOverlay(toggleBoolean);
  }

  return {
    handleToggleGrid,
    handleToggleSpecials,
    handleToggleViewport,
    showGridLines,
    showSpecialTiles,
    showViewportOverlay,
  };
}
