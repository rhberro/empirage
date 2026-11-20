/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, Text } from '@chakra-ui/react';

import type { HuntingLocation } from '~/entities/hunting-location';

import { GridDimensionInputs } from './GridDimensionInputs';
import { HeaderBadges } from './HeaderBadges';
import { MapEditorNotificationBanner } from './MapEditorNotificationBanner';
import type { SpecialCounts, StatusMessage } from './types';

type LocationList = Array<HuntingLocation>;
type ToggleHandler = () => void;
type ActionHandler = () => void;

interface MapEditorHeaderProps {
  canRedo: boolean;
  canUndo: boolean;
  configuredSpeciesCount: number;
  configuredWaveRangesCount: number;
  locations: LocationList;
  mapHeight: number;
  mapWidth: number;
  onClearAll: ActionHandler;
  onHeightChange: (val: number) => void;
  onOpenCreateLocationModal: ActionHandler;
  onOpenExportModal: ActionHandler;
  onOpenSpeciesModal: ActionHandler;
  onOpenWaveRangesModal: ActionHandler;
  onRedo: ActionHandler;
  onSave: ActionHandler;
  onSelectLocation: (id: number) => void;
  onToggleGrid: ToggleHandler;
  onToggleSpecials: ToggleHandler;
  onToggleViewport: ToggleHandler;
  onUndo: ActionHandler;
  onWidthChange: (val: number) => void;
  saving: boolean;
  selectedLocationId: number | null;
  showGridLines: boolean;
  showSpecialTiles: boolean;
  showViewportOverlay: boolean;
  specialCounts: SpecialCounts;
  statusMessage?: StatusMessage | null;
}

const SELECT_STYLE: React.CSSProperties = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '4px',
  color: 'white',
  fontSize: '12px',
  padding: '4px 8px',
};

function renderOption(loc: HuntingLocation): React.ReactElement {
  const label = `#${loc.id} - ${loc.name} (${loc.slug})`;
  return (
    <option key={loc.id} value={loc.id}>
      {label}
    </option>
  );
}

export function MapEditorHeader(props: MapEditorHeaderProps): React.ReactElement {
  const {
    canRedo,
    canUndo,
    configuredSpeciesCount,
    configuredWaveRangesCount,
    locations,
    mapHeight,
    mapWidth,
    onClearAll,
    onHeightChange,
    onOpenCreateLocationModal,
    onOpenExportModal,
    onOpenSpeciesModal,
    onOpenWaveRangesModal,
    onRedo,
    onSave,
    onSelectLocation,
    onToggleGrid,
    onToggleSpecials,
    onToggleViewport,
    onUndo,
    onWidthChange,
    saving,
    selectedLocationId,
    showGridLines,
    showSpecialTiles,
    showViewportOverlay,
    specialCounts,
    statusMessage = null,
  } = props;

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    onSelectLocation(Number(e.target.value));
  }

  const isUndoDisabled = !canUndo;
  const isRedoDisabled = !canRedo;

  const gridVariant = showGridLines ? 'solid' : 'outline';
  const gridPalette = showGridLines ? 'blue' : 'gray';
  const specialsVariant = showSpecialTiles ? 'solid' : 'outline';
  const specialsPalette = showSpecialTiles ? 'purple' : 'gray';
  const viewportVariant = showViewportOverlay ? 'solid' : 'outline';
  const viewportPalette = showViewportOverlay ? 'teal' : 'gray';

  const savePalette = specialCounts.canSave ? 'green' : 'gray';
  const isSaveDisabled = !specialCounts.canSave || saving;
  const isExportDisabled = selectedLocationId === null;

  const selectValue = selectedLocationId === null ? '' : selectedLocationId;
  const renderedOptions = locations.map(renderOption);

  return (
    <Box>
      <HStack
        bg="gray.900"
        borderBottom="1px solid"
        borderColor="gray.800"
        justify="space-between"
        px="4"
        py="2"
      >
        <HStack gap="3">
          <Text fontSize="md" fontWeight="bold">
            🗺️ Editor de Mapas
          </Text>

          <HStack gap="1.5">
            <Button
              disabled={isUndoDisabled}
              onClick={onUndo}
              size="2xs"
              title="Desfazer (Ctrl+Z)"
              type="button"
              variant="outline"
            >
              ↩️ Desfazer
            </Button>
            <Button
              disabled={isRedoDisabled}
              onClick={onRedo}
              size="2xs"
              title="Refazer (Ctrl+Y)"
              type="button"
              variant="outline"
            >
              ↪️ Refazer
            </Button>
          </HStack>

          <HStack gap="2">
            <Text color="gray.400" fontSize="xs">
              Local:
            </Text>
            <select onChange={handleSelectChange} style={SELECT_STYLE} value={selectValue}>
              {renderedOptions}
            </select>
            <Button
              colorPalette="blue"
              onClick={onOpenCreateLocationModal}
              size="2xs"
              title="Criar novo local de caça"
              type="button"
              variant="outline"
            >
              + Novo
            </Button>
          </HStack>

          <HStack gap="1.5">
            <Button
              colorPalette="cyan"
              onClick={onOpenSpeciesModal}
              size="2xs"
              type="button"
              variant="outline"
            >
              🐾 Spawns ({configuredSpeciesCount})
            </Button>
            <Button
              colorPalette="teal"
              onClick={onOpenWaveRangesModal}
              size="2xs"
              type="button"
              variant="outline"
            >
              🌊 Ondas ({configuredWaveRangesCount})
            </Button>
          </HStack>

          <GridDimensionInputs
            mapHeight={mapHeight}
            mapWidth={mapWidth}
            onHeightChange={onHeightChange}
            onWidthChange={onWidthChange}
          />

          <HStack gap="1">
            <Button
              colorPalette={gridPalette}
              onClick={onToggleGrid}
              size="2xs"
              type="button"
              variant={gridVariant}
            >
              Grid
            </Button>
            <Button
              colorPalette={specialsPalette}
              onClick={onToggleSpecials}
              size="2xs"
              type="button"
              variant={specialsVariant}
            >
              Scripts
            </Button>
            <Button
              colorPalette={viewportPalette}
              onClick={onToggleViewport}
              size="2xs"
              type="button"
              variant={viewportVariant}
            >
              Show Viewport
            </Button>
            <Button
              colorPalette="red"
              onClick={onClearAll}
              size="2xs"
              type="button"
              variant="subtle"
            >
              Limpar
            </Button>
          </HStack>
        </HStack>

        <HStack gap="3">
          <HeaderBadges specialCounts={specialCounts} />

          <Button
            colorPalette="purple"
            disabled={isExportDisabled}
            onClick={onOpenExportModal}
            size="sm"
            title="Exportar para SQL do seed"
            type="button"
            variant="outline"
          >
            Exportar
          </Button>

          <Button
            colorPalette={savePalette}
            disabled={isSaveDisabled}
            loading={saving}
            onClick={onSave}
            size="sm"
            type="button"
          >
            Salvar Mapa
          </Button>
        </HStack>
      </HStack>
      <MapEditorNotificationBanner message={statusMessage} />
    </Box>
  );
}
