/* eslint-disable oxsome/no-inline-structural-types */
import { Box, HStack } from '@chakra-ui/react';

import { LayersPanel, MapCanvas, TilePalette } from './editor-components';
import type {
  BrushType,
  EditorTool,
  HuntingLocationAnimation,
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
} from './types';
import type { UseLayersManagerResult } from './use-layers-manager';

interface EditorWorkspaceProps {
  animations: Array<HuntingLocationAnimation>;
  defaultTileFrame: number;
  layersManager: UseLayersManagerResult;
  mapHeight: number;
  mapWidth: number;
  onOpenAnimationModal: () => void;
  onRecordAction: () => void;
  onSelectBrush: (b: BrushType) => void;
  onSelectTool: (t: EditorTool) => void;
  onSpecialTilesChange: (s: Array<HuntingLocationSpecialTile>) => void;
  onTilesChange: (t: Array<HuntingLocationMapTile>) => void;
  selectedBrush: BrushType;
  selectedTool: EditorTool;
  showGridLines: boolean;
  showSpecialTiles: boolean;
  showViewportOverlay: boolean;
  specialTiles: Array<HuntingLocationSpecialTile>;
  tiles: Array<HuntingLocationMapTile>;
  tilesetImage: HTMLImageElement | null;
}

export function EditorWorkspace(props: EditorWorkspaceProps): React.ReactElement {
  const {
    animations,
    defaultTileFrame,
    layersManager,
    mapHeight,
    mapWidth,
    onOpenAnimationModal,
    onRecordAction,
    onSelectBrush,
    onSelectTool,
    onSpecialTilesChange,
    onTilesChange,
    selectedBrush,
    selectedTool,
    showGridLines,
    showSpecialTiles,
    showViewportOverlay,
    specialTiles,
    tiles,
    tilesetImage,
  } = props;

  return (
    <HStack flex="1" gap="0" overflow="hidden" w="full">
      <Box display="flex" flexDirection="column" h="full" w="280px">
        <Box flex="1" overflow="hidden">
          <TilePalette
            animations={animations}
            onOpenAnimationModal={onOpenAnimationModal}
            onSelectBrush={onSelectBrush}
            onSelectTool={onSelectTool}
            selectedBrush={selectedBrush}
            selectedTool={selectedTool}
            tilesetImage={tilesetImage}
          />
        </Box>
        <LayersPanel
          activeLayerId={layersManager.activeLayerId}
          layers={layersManager.layers}
          onAddLayer={layersManager.handleAddLayer}
          onDeleteLayer={layersManager.handleDeleteLayer}
          onSelectLayer={layersManager.handleSelectLayer}
          onTogglePlacement={layersManager.handleTogglePlacement}
          onToggleVisibility={layersManager.handleToggleVisibility}
          onUpdateLayerName={layersManager.handleUpdateLayerName}
        />
      </Box>
      <MapCanvas
        activeLayerId={layersManager.activeLayerId}
        defaultTileFrame={defaultTileFrame}
        height={mapHeight}
        layers={layersManager.layers}
        onLayersChange={layersManager.setLayers}
        onRecordAction={onRecordAction}
        onSelectBrush={onSelectBrush}
        onSelectTool={onSelectTool}
        onSpecialTilesChange={onSpecialTilesChange}
        onTilesChange={onTilesChange}
        selectedBrush={selectedBrush}
        selectedTool={selectedTool}
        showGridLines={showGridLines}
        showSpecialTiles={showSpecialTiles}
        showViewportOverlay={showViewportOverlay}
        specialTiles={specialTiles}
        tiles={tiles}
        tilesetImage={tilesetImage}
        width={mapWidth}
      />
    </HStack>
  );
}
