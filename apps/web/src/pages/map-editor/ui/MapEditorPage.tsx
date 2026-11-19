/* eslint-disable oxsome/no-inline-structural-types */
import { Box, HStack } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

import {
  EditorModals,
  MapCanvas,
  MapEditorHeader,
  MapEditorLoading,
  TilePalette,
  useEditorVisibilityToggles,
  useLocationsLoader,
  useSpeciesCatalog,
  useTilesetImage,
} from './editor-components';
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
import type {
  BrushType,
  EditorTool,
  HuntingLocation,
  HuntingLocationAnimation,
  HuntingLocationMap,
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
  HuntingLocationSpecies,
  HuntingLocationWaveRange,
  SpecialCounts,
  StatusMessage,
} from './types';
import { type UseCreateLocationParams, useCreateLocation } from './use-create-location';
import { useEditorHistory } from './use-editor-history';
import { useEditorModalsState } from './use-editor-modals-state';
import { type UseExportSqlParams, useExportSql } from './use-export-sql';

export function MapEditorPage(): React.ReactElement {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedTilesetUrl, setSelectedTilesetUrl] = useState('/assets/tilesets/exterior.png');
  const [configuredSpecies, setConfiguredSpecies] = useState<Array<HuntingLocationSpecies>>(
    INITIAL_CONFIGURED_SPECIES,
  );
  const [configuredWaveRanges, setConfiguredWaveRanges] = useState<Array<HuntingLocationWaveRange>>(
    INITIAL_CONFIGURED_WAVE_RANGES,
  );
  const modals = useEditorModalsState();
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [mapWidth, setMapWidth] = useState(VIEWPORT_GRID_WIDTH);
  const [mapHeight, setMapHeight] = useState(VIEWPORT_GRID_HEIGHT);
  const [tileSize, setTileSize] = useState(16);
  const [defaultTileFrame, setDefaultTileFrame] = useState(0);
  const [tiles, setTiles] = useState<Array<HuntingLocationMapTile>>(INITIAL_TILES);
  const [specialTiles, setSpecialTiles] =
    useState<Array<HuntingLocationSpecialTile>>(INITIAL_SPECIALS);
  const [animations, setAnimations] = useState<Array<HuntingLocationAnimation>>(INITIAL_ANIMS);

  const [selectedTool, setSelectedTool] = useState<EditorTool>(INITIAL_TOOL);
  const [selectedBrush, setSelectedBrush] = useState<BrushType>(INITIAL_BRUSH);
  const toggles = useEditorVisibilityToggles();

  const tilesetImage = useTilesetImage(selectedTilesetUrl);
  const speciesCatalog = useSpeciesCatalog();

  const historyState = { mapHeight, mapWidth, specialTiles, tiles };
  const historySetters = { setMapHeight, setMapWidth, setSpecialTiles, setTiles };
  const history = useEditorHistory(historyState, historySetters);

  function applyLocationMap(location: HuntingLocation): void {
    const map = location.map;
    setMapWidth(map.width || VIEWPORT_GRID_WIDTH);
    setMapHeight(map.height || VIEWPORT_GRID_HEIGHT);
    setTileSize(map.tileSize || 16);
    setDefaultTileFrame(map.defaultTileFrame || 0);
    setTiles(map.tiles ? Array.from(map.tiles) : []);
    setAnimations(map.animations ? Array.from(map.animations) : []);
    setSelectedTilesetUrl(location.tilesetUrl || '/assets/tilesets/exterior.png');
    setConfiguredSpecies(location.species ? Array.from(location.species) : []);
    setConfiguredWaveRanges(location.waveRanges ? Array.from(location.waveRanges) : []);
    const hasSpecials = Boolean(map.specialTiles && map.specialTiles.length > 0);
    const initialSpecials = hasSpecials ? Array.from(map.specialTiles) : DEFAULT_SPECIALS;
    setSpecialTiles(initialSpecials);
    history.clearHistory();
    setStatusMessage(null);
  }

  function handleFirstLocation(first: HuntingLocation): void {
    if (selectedLocationId === null) {
      setSelectedLocationId(first.id);
      applyLocationMap(first);
    }
  }

  const { loading, locations, setLocations } = useLocationsLoader(
    handleFirstLocation,
    setStatusMessage,
  );

  const currentMap: HuntingLocationMap = {
    animations,
    defaultTileFrame,
    height: mapHeight,
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
      <HStack flex="1" gap="0" overflow="hidden" w="full">
        <TilePalette
          animations={animations}
          onOpenAnimationModal={modals.handleOpenAnimationModal}
          onSelectBrush={setSelectedBrush}
          onSelectTool={setSelectedTool}
          selectedBrush={selectedBrush}
          selectedTool={selectedTool}
          tilesetImage={tilesetImage}
        />
        <MapCanvas
          defaultTileFrame={defaultTileFrame}
          height={mapHeight}
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
          width={mapWidth}
        />
      </HStack>
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
