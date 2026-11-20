/* eslint-disable oxsome/no-inline-structural-types */
import { Box } from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';

import {
  EditorModals,
  MapEditorHeader,
  MapEditorLoading,
  useEditorModalsState,
  useEditorVisibilityToggles,
  useLocationsLoader,
  useSpeciesCatalog,
  useTilesetImage,
} from './editor-components';
import { EditorWorkspace } from './EditorWorkspace';
import {
  computeSpecialCounts,
  DEFAULT_SPECIALS,
  EMPTY_TILES_LIST,
  INITIAL_ANIMS,
  INITIAL_BRUSH,
  INITIAL_CONFIGURED_SPECIES,
  INITIAL_CONFIGURED_WAVE_RANGES,
  INITIAL_SPECIALS,
  INITIAL_TILES,
  INITIAL_TOOL,
  makeLocationUpdater,
  MSG_CLEAR_SUCCESS,
  MSG_SAVE_ERROR,
  MSG_SAVE_SUCCESS,
  MSG_VALIDATION_FAIL,
  persistMap,
  VIEWPORT_GRID_HEIGHT,
  VIEWPORT_GRID_WIDTH,
} from './map-editor-logic';
import type { HuntingLocation, HuntingLocationMap, StatusMessage } from './types';
import { type UseCreateLocationParams, useCreateLocation } from './use-create-location';
import { useEditorHistory } from './use-editor-history';
import { type UseExportSqlParams, useExportSql } from './use-export-sql';
import {
  createInitialLayers,
  INITIAL_DEFAULT_LAYERS,
  useLayersManager,
} from './use-layers-manager';

export function MapEditorPage(): React.ReactElement {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedTilesetUrl, setSelectedTilesetUrl] = useState('/assets/tiles/editor-tileset.png');
  const [configuredSpecies, setConfiguredSpecies] = useState(INITIAL_CONFIGURED_SPECIES);
  const [configuredWaveRanges, setConfiguredWaveRanges] = useState(INITIAL_CONFIGURED_WAVE_RANGES);
  const modals = useEditorModalsState();
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [mapWidth, setMapWidth] = useState(VIEWPORT_GRID_WIDTH);
  const [mapHeight, setMapHeight] = useState(VIEWPORT_GRID_HEIGHT);
  const [tileSize, setTileSize] = useState(16);
  const [defaultTileFrame, setDefaultTileFrame] = useState(0);
  const [tiles, setTiles] = useState(INITIAL_TILES);
  const [specialTiles, setSpecialTiles] = useState(INITIAL_SPECIALS);
  const [animations, setAnimations] = useState(INITIAL_ANIMS);

  const [selectedTool, setSelectedTool] = useState(INITIAL_TOOL);
  const [selectedBrush, setSelectedBrush] = useState(INITIAL_BRUSH);
  const toggles = useEditorVisibilityToggles();

  const tilesetImage = useTilesetImage(selectedTilesetUrl);
  const speciesCatalog = useSpeciesCatalog();

  const [layers, setLayers] = useState(INITIAL_DEFAULT_LAYERS);

  const historyState = { layers, mapHeight, mapWidth, specialTiles, tiles };
  const historySetters = { setLayers, setMapHeight, setMapWidth, setSpecialTiles, setTiles };
  const history = useEditorHistory(historyState, historySetters);
  const layersManager = useLayersManager(history.pushHistorySnapshot, layers, setLayers);

  function applyLocationMap(location: HuntingLocation): void {
    const map = location.map;
    setMapWidth(map.width || VIEWPORT_GRID_WIDTH);
    setMapHeight(map.height || VIEWPORT_GRID_HEIGHT);
    setTileSize(map.tileSize || 16);
    setDefaultTileFrame(map.defaultTileFrame || 0);
    const locTiles = map.tiles ? Array.from(map.tiles) : [];
    setTiles(locTiles);

    const initialLayers = createInitialLayers(map.layers, locTiles);
    layersManager.setLayers(initialLayers);
    layersManager.setActiveLayerId(initialLayers[0].id);

    setAnimations(map.animations ? Array.from(map.animations) : []);
    setSelectedTilesetUrl(location.tilesetUrl || '/assets/tilesets/route-1.png');
    setConfiguredSpecies(location.species ? Array.from(location.species) : []);
    setConfiguredWaveRanges(location.waveRanges ? Array.from(location.waveRanges) : []);
    const hasSpecials = Boolean(map.specialTiles && map.specialTiles.length > 0);
    const initialSpecials = hasSpecials ? Array.from(map.specialTiles) : DEFAULT_SPECIALS;
    setSpecialTiles(initialSpecials);
    history.clearHistory();
    setStatusMessage(null);
  }

  const applyLocationMapCallback = useCallback(applyLocationMap, [history, layersManager]);

  function handleFirstLocation(first: HuntingLocation): void {
    if (selectedLocationId === null) {
      setSelectedLocationId(first.id);
      applyLocationMapCallback(first);
    }
  }

  const handleFirstLocationCallback = useCallback(handleFirstLocation, [
    applyLocationMapCallback,
    selectedLocationId,
  ]);

  const { loading, locations, setLocations } = useLocationsLoader(
    handleFirstLocationCallback,
    setStatusMessage,
  );

  const currentMap: HuntingLocationMap = {
    animations,
    defaultTileFrame,
    height: mapHeight,
    layers: layersManager.layers,
    specialTiles,
    tileSize,
    tiles,
    width: mapWidth,
  };

  const exportParams: UseExportSqlParams = {
    configuredSpecies,
    configuredWaveRanges,
    currentMap,
    locations,
    selectedLocationId,
    selectedTilesetUrl,
  };
  const exportAction = useExportSql(exportParams);

  const createParams: UseCreateLocationParams = {
    applyLocationMap,
    mapHeight,
    mapWidth,
    selectedTilesetUrl,
    setLocations,
    setSelectedLocationId,
  };
  const createAction = useCreateLocation(createParams);

  function handleSelectLocation(locationId: number): void {
    setSelectedLocationId(locationId);
    function matchLoc(l: HuntingLocation): boolean {
      return l.id === locationId;
    }
    const loc = locations.find(matchLoc);
    if (loc) {
      applyLocationMap(loc);
    }
  }

  function handleClearAll(): void {
    history.pushHistorySnapshot();
    setMapWidth(VIEWPORT_GRID_WIDTH);
    setMapHeight(VIEWPORT_GRID_HEIGHT);
    setTiles(EMPTY_TILES_LIST);
    setSpecialTiles(DEFAULT_SPECIALS);
    setStatusMessage(MSG_CLEAR_SUCCESS);
  }

  function handleWidthChange(w: number): void {
    history.pushHistorySnapshot();
    setMapWidth(w);
  }

  function handleHeightChange(h: number): void {
    history.pushHistorySnapshot();
    setMapHeight(h);
  }

  function countSpecials(): SpecialCounts {
    return computeSpecialCounts(specialTiles);
  }

  const specialCounts = useMemo(countSpecials, [specialTiles]);

  async function handleSaveMap(): Promise<void> {
    if (!selectedLocationId) {
      return;
    }
    if (!specialCounts.canSave) {
      setStatusMessage(MSG_VALIDATION_FAIL);
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    try {
      const updated = await persistMap(
        selectedLocationId,
        currentMap,
        selectedTilesetUrl,
        configuredSpecies,
        configuredWaveRanges,
      );
      setLocations(makeLocationUpdater(updated));
      setStatusMessage(MSG_SAVE_SUCCESS);
      setSaving(false);
    } catch {
      setStatusMessage(MSG_SAVE_ERROR);
      setSaving(false);
    }
  }

  if (loading) {
    return <MapEditorLoading />;
  }

  return (
    <Box bg="gray.950" color="white" display="flex" flexDirection="column" h="100vh" w="100vw">
      <MapEditorHeader
        canRedo={history.canRedo}
        canUndo={history.canUndo}
        configuredSpeciesCount={configuredSpecies.length}
        configuredWaveRangesCount={configuredWaveRanges.length}
        locations={locations}
        mapHeight={mapHeight}
        mapWidth={mapWidth}
        onClearAll={handleClearAll}
        onHeightChange={handleHeightChange}
        onOpenCreateLocationModal={createAction.handleOpenCreateLocationModal}
        onOpenExportModal={exportAction.handleOpenExportModal}
        onOpenSpeciesModal={modals.handleOpenSpeciesModal}
        onOpenWaveRangesModal={modals.handleOpenWaveRangesModal}
        onRedo={history.handleRedo}
        onSave={handleSaveMap}
        onSelectLocation={handleSelectLocation}
        onSelectTileset={setSelectedTilesetUrl}
        onToggleGrid={toggles.handleToggleGrid}
        onToggleSpecials={toggles.handleToggleSpecials}
        onToggleViewport={toggles.handleToggleViewport}
        onUndo={history.handleUndo}
        onWidthChange={handleWidthChange}
        saving={saving}
        selectedLocationId={selectedLocationId}
        selectedTilesetUrl={selectedTilesetUrl}
        showGridLines={toggles.showGridLines}
        showSpecialTiles={toggles.showSpecialTiles}
        showViewportOverlay={toggles.showViewportOverlay}
        specialCounts={specialCounts}
        statusMessage={statusMessage}
      />
      <EditorWorkspace
        animations={animations}
        defaultTileFrame={defaultTileFrame}
        layersManager={layersManager}
        mapHeight={mapHeight}
        mapWidth={mapWidth}
        onOpenAnimationModal={modals.handleOpenAnimationModal}
        onRecordAction={history.pushHistorySnapshot}
        onSelectBrush={setSelectedBrush}
        onSelectTool={setSelectedTool}
        onSpecialTilesChange={setSpecialTiles}
        onTilesChange={setTiles}
        selectedBrush={selectedBrush}
        selectedTool={selectedTool}
        showGridLines={toggles.showGridLines}
        showSpecialTiles={toggles.showSpecialTiles}
        showViewportOverlay={toggles.showViewportOverlay}
        specialTiles={specialTiles}
        tiles={tiles}
        tilesetImage={tilesetImage}
      />
      <EditorModals
        animations={animations}
        configuredSpecies={configuredSpecies}
        configuredWaveRanges={configuredWaveRanges}
        exportSql={exportAction.exportSql}
        isAnimationModalOpen={modals.isAnimationModalOpen}
        isCreateLocationModalOpen={createAction.isCreateLocationModalOpen}
        isCreatingLocation={createAction.isCreatingLocation}
        isExportModalOpen={exportAction.isExportModalOpen}
        isSpeciesModalOpen={modals.isSpeciesModalOpen}
        isWaveRangesModalOpen={modals.isWaveRangesModalOpen}
        onCloseAnimationModal={modals.handleCloseAnimationModal}
        onCloseCreateLocationModal={createAction.handleCloseCreateLocationModal}
        onCloseExportModal={exportAction.handleCloseExportModal}
        onCloseSpeciesModal={modals.handleCloseSpeciesModal}
        onCloseWaveRangesModal={modals.handleCloseWaveRangesModal}
        onCreateLocation={createAction.handleCreateLocation}
        onSaveAnimations={setAnimations}
        onSaveSpecies={setConfiguredSpecies}
        onSaveWaveRanges={setConfiguredWaveRanges}
        speciesCatalog={speciesCatalog}
      />
    </Box>
  );
}
