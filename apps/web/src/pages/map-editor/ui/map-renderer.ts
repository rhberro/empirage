/* eslint-disable oxsome/no-inline-structural-types */
import type { HuntingLocationSpecialTile } from '~/entities/hunting-location';

import { getTileSourceCoordinates } from './tile-coords';

const TILE_SIZE = 16;
const VIEWPORT_WIDTH_TILES = 30;
const VIEWPORT_HEIGHT_TILES = 18;
const EMPTY_DASH_ARRAY: Array<number> = [];

export interface Point {
  x: number;
  y: number;
}

export interface TileCoord {
  col: number;
  row: number;
}

export interface RectSelection {
  endCol: number;
  endRow: number;
  startCol: number;
  startRow: number;
}

export interface StoredTile {
  animationId?: string | null;
  frame: number;
}

export type SpecialTileLookup = Map<string, HuntingLocationSpecialTile>;
export type TileLookup = Map<string, StoredTile>;

export interface RenderCanvasOptions {
  activeRectPreview: RectSelection | null;
  canvas: HTMLCanvasElement;
  defaultTileFrame: number;
  height: number;
  offset: Point;
  scale: number;
  showGridLines: boolean;
  showSpecialTiles: boolean;
  showViewportOverlay: boolean;
  specialTileMap: SpecialTileLookup;
  tileMap: TileLookup;
  tilesetImage: HTMLImageElement | null;
  width: number;
}

function drawTerrain(context: CanvasRenderingContext2D, options: RenderCanvasOptions): void {
  const { defaultTileFrame, height, tileMap, tilesetImage, width } = options;

  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const key = `${c},${r}`;
      const tileData = tileMap.get(key);
      const frame = tileData ? tileData.frame : defaultTileFrame;

      if (tilesetImage) {
        const { sx, sy } = getTileSourceCoordinates(frame, tilesetImage.naturalHeight);
        context.drawImage(
          tilesetImage,
          sx,
          sy,
          TILE_SIZE,
          TILE_SIZE,
          c * TILE_SIZE,
          r * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      } else {
        context.fillStyle = (r + c) % 2 === 0 ? '#3f3f46' : '#52525b';
        context.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }

      if (tileData && tileData.animationId) {
        context.fillStyle = 'rgba(6, 182, 212, 0.8)';
        context.fillRect(c * TILE_SIZE, r * TILE_SIZE, 4, 4);
      }
    }
  }
}

function getSpecialTileStyle(kind: string): { fill: string; label: string } {
  if (kind === 'enemy_spawn') {
    return { fill: 'rgba(168, 85, 247, 0.5)', label: 'S' };
  }
  if (kind === 'trainer_spawn') {
    return { fill: 'rgba(59, 130, 246, 0.5)', label: 'T' };
  }
  if (kind === 'creature_spawn') {
    return { fill: 'rgba(34, 197, 94, 0.5)', label: 'C' };
  }
  return { fill: 'rgba(239, 68, 68, 0.5)', label: 'B' };
}

function drawSpecialTiles(
  context: CanvasRenderingContext2D,
  specialTileMap: SpecialTileLookup,
  width: number,
  height: number,
): void {
  for (const [key, s] of specialTileMap.entries()) {
    const parts = key.split(',');
    const cx = Number(parts[0]);
    const cy = Number(parts[1]);
    if (cx < width && cy < height) {
      const { fill, label } = getSpecialTileStyle(s.kind);

      context.fillStyle = fill;
      context.fillRect(cx * TILE_SIZE, cy * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      context.fillStyle = '#ffffff';
      context.font = 'bold 8px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, cx * TILE_SIZE + TILE_SIZE / 2, cy * TILE_SIZE + TILE_SIZE / 2);
    }
  }
}

function drawViewportBoxes(
  context: CanvasRenderingContext2D,
  specialTileMap: SpecialTileLookup,
  scale: number,
): void {
  const vpWidthPx = VIEWPORT_WIDTH_TILES * TILE_SIZE;
  const vpHeightPx = VIEWPORT_HEIGHT_TILES * TILE_SIZE;
  const dash = 4 / scale;
  const dashPattern = [dash, dash];

  for (const s of specialTileMap.values()) {
    if (s.kind === 'creature_spawn') {
      const creatureCenterX = (s.x + 0.5) * TILE_SIZE;
      const creatureCenterY = (s.y + 0.5) * TILE_SIZE;
      const vx = creatureCenterX - vpWidthPx / 2;
      const vy = creatureCenterY - vpHeightPx / 2;

      context.fillStyle = 'rgba(16, 185, 129, 0.08)';
      context.fillRect(vx, vy, vpWidthPx, vpHeightPx);

      context.strokeStyle = '#10b981';
      context.lineWidth = 1.5 / scale;
      context.setLineDash(dashPattern);
      context.strokeRect(vx, vy, vpWidthPx, vpHeightPx);
      context.setLineDash(EMPTY_DASH_ARRAY);

      context.fillStyle = '#10b981';
      context.font = 'bold 9px sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillText(`Viewport (${s.x}, ${s.y})`, vx + 3, vy + 3);
    }
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  scale: number,
): void {
  context.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  context.lineWidth = 1 / scale;
  context.beginPath();
  for (let x = 0; x <= widthPx; x += TILE_SIZE) {
    context.moveTo(x, 0);
    context.lineTo(x, heightPx);
  }
  for (let y = 0; y <= heightPx; y += TILE_SIZE) {
    context.moveTo(0, y);
    context.lineTo(widthPx, y);
  }
  context.stroke();
}

function drawRectPreview(
  context: CanvasRenderingContext2D,
  rect: RectSelection,
  scale: number,
): void {
  const minCol = Math.min(rect.startCol, rect.endCol);
  const maxCol = Math.max(rect.startCol, rect.endCol);
  const minRow = Math.min(rect.startRow, rect.endRow);
  const maxRow = Math.max(rect.startRow, rect.endRow);

  const px = minCol * TILE_SIZE;
  const py = minRow * TILE_SIZE;
  const pw = (maxCol - minCol + 1) * TILE_SIZE;
  const ph = (maxRow - minRow + 1) * TILE_SIZE;

  context.fillStyle = 'rgba(59, 130, 246, 0.35)';
  context.fillRect(px, py, pw, ph);

  context.strokeStyle = '#60a5fa';
  context.lineWidth = 1.5 / scale;
  context.strokeRect(px, py, pw, ph);
}

function renderMapLayers(
  context: CanvasRenderingContext2D,
  options: RenderCanvasOptions,
  mapPxWidth: number,
  mapPxHeight: number,
): void {
  const {
    activeRectPreview,
    height,
    scale,
    showGridLines,
    showSpecialTiles,
    showViewportOverlay,
    specialTileMap,
    width,
  } = options;

  drawTerrain(context, options);

  if (showSpecialTiles) {
    drawSpecialTiles(context, specialTileMap, width, height);
  }
  if (showViewportOverlay) {
    drawViewportBoxes(context, specialTileMap, scale);
  }
  if (showGridLines) {
    drawGrid(context, mapPxWidth, mapPxHeight, scale);
  }
  if (activeRectPreview) {
    drawRectPreview(context, activeRectPreview, scale);
  }

  context.strokeStyle = '#eab308';
  context.lineWidth = 2 / scale;
  context.strokeRect(0, 0, mapPxWidth, mapPxHeight);
}

export function drawMapToCanvas(options: RenderCanvasOptions): void {
  const { canvas, height, offset, scale, width } = options;

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.translate(offset.x, offset.y);
  context.scale(scale, scale);

  const mapPxWidth = width * TILE_SIZE;
  const mapPxHeight = height * TILE_SIZE;

  context.fillStyle = '#18181b';
  context.fillRect(0, 0, mapPxWidth, mapPxHeight);

  renderMapLayers(context, options, mapPxWidth, mapPxHeight);

  context.restore();
}
