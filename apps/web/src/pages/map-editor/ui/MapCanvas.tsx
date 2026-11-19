/* eslint-disable max-lines, oxsome/no-inline-structural-types */
import { Box } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
} from '~/entities/hunting-location';

import {
  applyStampToMap,
  buildSpecialLookup,
  buildTileLookup,
  exportTilesFromLookup,
  extractStampFromMap,
  performFloodFill,
} from './map-canvas-tools';
import {
  drawMapToCanvas,
  type LayerRenderData,
  type Point,
  type RectSelection,
  type StoredTile,
  type TileCoord,
} from './map-renderer';
import type { BrushType, EditorTool, HuntingLocationMapLayer } from './types';

const TILE_SIZE = 16;
const INITIAL_OFFSET: Point = { x: 40, y: 40 };
const INITIAL_PAN_START: Point = { x: 0, y: 0 };

type BrushChangeHandler = (brush: BrushType) => void;
type TilesChangeHandler = (tiles: Array<HuntingLocationMapTile>) => void;
type LayersChangeHandler = (layers: Array<HuntingLocationMapLayer>) => void;
type SpecialTilesChangeHandler = (specialTiles: Array<HuntingLocationSpecialTile>) => void;
type SelectToolHandler = (tool: EditorTool) => void;
type RecordActionHandler = () => void;

interface MapCanvasProps {
  activeLayerId?: string;
  defaultTileFrame: number;
  height: number;
  layers?: Array<HuntingLocationMapLayer>;
  onLayersChange?: LayersChangeHandler;
  onRecordAction: RecordActionHandler;
  onSelectBrush: BrushChangeHandler;
  onSelectTool: SelectToolHandler;
  onSpecialTilesChange: SpecialTilesChangeHandler;
  onTilesChange: TilesChangeHandler;
  selectedBrush: BrushType;
  selectedTool: EditorTool;
  showGridLines: boolean;
  showSpecialTiles: boolean;
  showViewportOverlay: boolean;
  specialTiles: Array<HuntingLocationSpecialTile>;
  tiles: Array<HuntingLocationMapTile>;
  tilesetImage: HTMLImageElement | null;
  width: number;
}

function preventContextMenu(e: React.MouseEvent): void {
  e.preventDefault();
}

function buildLayerRenderData(layer: HuntingLocationMapLayer): LayerRenderData {
  return {
    id: layer.id,
    name: layer.name,
    order: layer.order,
    placement: layer.placement,
    tileMap: buildTileLookup(layer.tiles),
    visible: layer.visible,
  };
}

function isBaseLayer(layer: HuntingLocationMapLayer): boolean {
  return layer.order === 0;
}

export function MapCanvas(props: MapCanvasProps): React.ReactElement {
  const {
    activeLayerId,
    defaultTileFrame,
    height,
    layers,
    onLayersChange,
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
    width,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(2.5);
  const [offset, setOffset] = useState<Point>(INITIAL_OFFSET);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>(INITIAL_PAN_START);
  const [isPainting, setIsPainting] = useState(false);

  const [rectOrigin, setRectOrigin] = useState<TileCoord | null>(null);
  const [rectPreview, setRectPreview] = useState<RectSelection | null>(null);

  function createTileLookup(): ReturnType<typeof buildTileLookup> {
    return buildTileLookup(tiles);
  }

  function createSpecialLookup(): ReturnType<typeof buildSpecialLookup> {
    return buildSpecialLookup(specialTiles);
  }

  const tileMap = useMemo(createTileLookup, [tiles]);
  const specialTileMap = useMemo(createSpecialLookup, [specialTiles]);

  function computeRenderedLayers(): Array<LayerRenderData> | undefined {
    if (!layers || layers.length === 0) {
      return;
    }
    return layers.map(buildLayerRenderData);
  }

  const renderedLayers: Array<LayerRenderData> | undefined = useMemo(computeRenderedLayers, [
    layers,
  ]);

  function draw(): void {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const options = {
      activeRectPreview: rectPreview,
      canvas,
      defaultTileFrame,
      height,
      layers: renderedLayers,
      offset,
      scale,
      showGridLines,
      showSpecialTiles,
      showViewportOverlay,
      specialTileMap,
      tileMap,
      tilesetImage,
      width,
    };
    drawMapToCanvas(options);
  }

  const renderCanvas = useCallback(draw, [
    defaultTileFrame,
    height,
    offset,
    rectPreview,
    renderedLayers,
    scale,
    showGridLines,
    showSpecialTiles,
    showViewportOverlay,
    specialTileMap,
    tileMap,
    tilesetImage,
    width,
  ]);

  useEffect(renderCanvas, [renderCanvas]);

  function onWindowResize(): void {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container && canvas) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderCanvas();
    }
  }

  const resizeCallback = useCallback(onWindowResize, [renderCanvas]);

  function handleResizeEffect(): () => void {
    resizeCallback();
    globalThis.addEventListener('resize', resizeCallback);
    function cleanup(): void {
      globalThis.removeEventListener('resize', resizeCallback);
    }
    return cleanup;
  }

  useEffect(handleResizeEffect, [resizeCallback]);

  function updateTilesForActiveLayer(newTiles: Array<HuntingLocationMapTile>): void {
    function updateLayerTiles(layer: HuntingLocationMapLayer): HuntingLocationMapLayer {
      if (layer.id === activeLayerId) {
        return { ...layer, tiles: newTiles };
      }
      return layer;
    }

    if (layers && onLayersChange && activeLayerId) {
      const nextLayers = layers.map(updateLayerTiles);
      onLayersChange(nextLayers);
      const baseLayer = nextLayers.find(isBaseLayer) ?? nextLayers[0];
      if (baseLayer) {
        onTilesChange(baseLayer.tiles);
      }
      return;
    }
    onTilesChange(newTiles);
  }

  function applySingleTile(col: number, row: number): void {
    if (col < 0 || col >= width || row < 0 || row >= height) {
      return;
    }
    const key = `${col},${row}`;

    if (selectedTool.kind === 'tile') {
      const nextMap = new Map(tileMap);
      const newEntry: StoredTile = {
        animationId: selectedTool.animationId ?? null,
        frame: selectedTool.frame,
      };
      nextMap.set(key, newEntry);
      updateTilesForActiveLayer(exportTilesFromLookup(nextMap, width, height));
    } else if (selectedTool.kind === 'stamp') {
      const newTiles = applyStampToMap(col, row, selectedTool, tileMap, width, height);
      updateTilesForActiveLayer(newTiles);
    } else if (selectedTool.kind === 'special') {
      const nextSpecial = new Map(specialTileMap);
      const specialObj: HuntingLocationSpecialTile = {
        kind: selectedTool.specialKind,
        x: col,
        y: row,
      };
      nextSpecial.set(key, specialObj);
      onSpecialTilesChange(Array.from(nextSpecial.values()));
    } else if (selectedTool.kind === 'eraser') {
      if (specialTileMap.has(key)) {
        const nextSpecial = new Map(specialTileMap);
        nextSpecial.delete(key);
        onSpecialTilesChange(Array.from(nextSpecial.values()));
      } else if (tileMap.has(key)) {
        const nextMap = new Map(tileMap);
        nextMap.delete(key);
        updateTilesForActiveLayer(exportTilesFromLookup(nextMap, width, height));
      }
    }
  }

  function applyFloodFill(startCol: number, startRow: number): void {
    if (selectedTool.kind !== 'tile') {
      applySingleTile(startCol, startRow);
      return;
    }
    const filled = performFloodFill(
      startCol,
      startRow,
      tileMap,
      width,
      height,
      defaultTileFrame,
      selectedTool,
    );
    if (filled) {
      onRecordAction();
      updateTilesForActiveLayer(filled);
    }
  }

  function applyRectFill(minCol: number, maxCol: number, minRow: number, maxRow: number): void {
    onRecordAction();
    if (selectedTool.kind === 'tile') {
      const nextMap = new Map(tileMap);
      const fillEntry: StoredTile = {
        animationId: selectedTool.animationId ?? null,
        frame: selectedTool.frame,
      };
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) {
          nextMap.set(`${c},${r}`, fillEntry);
        }
      }
      updateTilesForActiveLayer(exportTilesFromLookup(nextMap, width, height));
    } else if (selectedTool.kind === 'special') {
      const nextSpecial = new Map(specialTileMap);
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) {
          nextSpecial.set(`${c},${r}`, {
            kind: selectedTool.specialKind,
            x: c,
            y: r,
          });
        }
      }
      onSpecialTilesChange(Array.from(nextSpecial.values()));
    } else if (selectedTool.kind === 'eraser') {
      const nextSpecial = new Map(specialTileMap);
      const nextMap = new Map(tileMap);
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) {
          nextSpecial.delete(`${c},${r}`);
          nextMap.delete(`${c},${r}`);
        }
      }
      onSpecialTilesChange(Array.from(nextSpecial.values()));
      updateTilesForActiveLayer(exportTilesFromLookup(nextMap, width, height));
    }
  }

  function getTileCoord(event: React.MouseEvent<HTMLCanvasElement>): TileCoord | null {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const canvasX = (mouseX - offset.x) / scale;
    const canvasY = (mouseY - offset.y) / scale;

    const col = Math.floor(canvasX / TILE_SIZE);
    const row = Math.floor(canvasY / TILE_SIZE);

    if (col >= 0 && col < width && row >= 0 && row < height) {
      return { col, row };
    }
    return null;
  }

  function handleEyedrop(coord: TileCoord): void {
    if (selectedTool.kind === 'stamp') {
      const defaultTool: EditorTool = { frame: defaultTileFrame, kind: 'tile' };
      onSelectTool(defaultTool);
      return;
    }
    const key = `${coord.col},${coord.row}`;
    const special = specialTileMap.get(key);
    if (special) {
      const specialTool: EditorTool = { kind: 'special', specialKind: special.kind };
      onSelectTool(specialTool);
      return;
    }
    const tile = tileMap.get(key);
    if (tile) {
      const tileTool: EditorTool = {
        animationId: tile.animationId,
        frame: tile.frame,
        kind: 'tile',
      };
      onSelectTool(tileTool);
    } else {
      const defaultTool: EditorTool = { frame: defaultTileFrame, kind: 'tile' };
      onSelectTool(defaultTool);
    }
  }

  function handleMouseDown(event: React.MouseEvent<HTMLCanvasElement>): void {
    if (event.button === 2) {
      event.preventDefault();
      const coord = getTileCoord(event);
      if (coord) {
        handleEyedrop(coord);
      }
      return;
    }

    if (event.button === 1 || event.shiftKey) {
      event.preventDefault();
      setIsPanning(true);
      const newPanStart: Point = { x: event.clientX - offset.x, y: event.clientY - offset.y };
      setPanStart(newPanStart);
      return;
    }

    if (event.button === 0) {
      const coord = getTileCoord(event);
      if (!coord) {
        return;
      }

      if (selectedTool.kind === 'stamp') {
        onRecordAction();
        setIsPainting(true);
        applySingleTile(coord.col, coord.row);
      } else if (selectedBrush === 'bucket') {
        applyFloodFill(coord.col, coord.row);
      } else if (selectedBrush === 'rect' || selectedBrush === 'select') {
        const newPreview: RectSelection = {
          endCol: coord.col,
          endRow: coord.row,
          startCol: coord.col,
          startRow: coord.row,
        };
        setRectOrigin(coord);
        setRectPreview(newPreview);
      } else {
        onRecordAction();
        setIsPainting(true);
        applySingleTile(coord.col, coord.row);
      }
    }
  }

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>): void {
    if (isPanning) {
      const nextOffset: Point = {
        x: event.clientX - panStart.x,
        y: event.clientY - panStart.y,
      };
      setOffset(nextOffset);
      return;
    }

    if (rectOrigin) {
      const coord = getTileCoord(event);
      if (coord) {
        const nextPreview: RectSelection = {
          endCol: coord.col,
          endRow: coord.row,
          startCol: rectOrigin.col,
          startRow: rectOrigin.row,
        };
        setRectPreview(nextPreview);
      }
      return;
    }

    if (isPainting) {
      const coord = getTileCoord(event);
      if (coord) {
        applySingleTile(coord.col, coord.row);
      }
    }
  }

  function handleMouseUp(): void {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isPainting) {
      setIsPainting(false);
    }
    if (rectOrigin && rectPreview) {
      const minCol = Math.min(rectPreview.startCol, rectPreview.endCol);
      const maxCol = Math.max(rectPreview.startCol, rectPreview.endCol);
      const minRow = Math.min(rectPreview.startRow, rectPreview.endRow);
      const maxRow = Math.max(rectPreview.startRow, rectPreview.endRow);

      if (selectedBrush === 'select') {
        const stampTool = extractStampFromMap(
          minCol,
          maxCol,
          minRow,
          maxRow,
          tileMap,
          defaultTileFrame,
        );
        onSelectTool(stampTool);
        onSelectBrush('pencil');
      } else {
        applyRectFill(minCol, maxCol, minRow, maxRow);
      }
      setRectOrigin(null);
      setRectPreview(null);
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.min(Math.max(0.5, scale * zoomFactor), 8.0);

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const newOffset = {
        x: mouseX - (mouseX - offset.x) * (newScale / scale),
        y: mouseY - (mouseY - offset.y) * (newScale / scale),
      };
      setOffset(newOffset);
    }
    setScale(newScale);
  }

  const cursorStyle = isPanning ? 'grab' : 'crosshair';
  const canvasStyle: React.CSSProperties = { cursor: cursorStyle, display: 'block' };

  return (
    <Box
      bg="black"
      flex="1"
      h="full"
      overflow="hidden"
      position="relative"
      ref={containerRef}
      userSelect="none"
    >
      <canvas
        onContextMenu={preventContextMenu}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        ref={canvasRef}
        style={canvasStyle}
      />
    </Box>
  );
}
