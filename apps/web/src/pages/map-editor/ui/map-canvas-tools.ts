/* eslint-disable oxsome/no-inline-structural-types */
import type {
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
} from '~/entities/hunting-location';

import type { SpecialTileLookup, StoredTile, TileCoord, TileLookup } from './map-renderer';
import type { EditorTool, StampTile } from './types';

export function buildTileLookup(tiles: Array<HuntingLocationMapTile>): TileLookup {
  const map: TileLookup = new Map();
  for (const t of tiles) {
    map.set(`${t.x},${t.y}`, { animationId: t.animationId, frame: t.frame });
  }
  return map;
}

export function buildSpecialLookup(
  specialTiles: Array<HuntingLocationSpecialTile>,
): SpecialTileLookup {
  const map: SpecialTileLookup = new Map();
  for (const s of specialTiles) {
    map.set(`${s.x},${s.y}`, s);
  }
  return map;
}

export function exportTilesFromLookup(
  tileMap: TileLookup,
  width: number,
  height: number,
): Array<HuntingLocationMapTile> {
  const list: Array<HuntingLocationMapTile> = [];
  for (const [coordKey, t] of tileMap.entries()) {
    const parts = coordKey.split(',');
    const col = Number(parts[0]);
    const row = Number(parts[1]);
    if (col < width && row < height) {
      const tile: HuntingLocationMapTile = {
        animationId: t.animationId,
        frame: t.frame,
        x: col,
        y: row,
      };
      list.push(tile);
    }
  }
  return list;
}

function shouldFillNeighbor(
  tile: StoredTile | undefined,
  defaultFrame: number,
  targetFrame: number,
  targetAnim: string | null,
): boolean {
  const frame = tile ? tile.frame : defaultFrame;
  const anim = tile ? (tile.animationId ?? null) : null;
  return frame === targetFrame && anim === targetAnim;
}

function getAdjacentNeighbors(c: number, r: number): Array<TileCoord> {
  return [
    { col: c + 1, row: r },
    { col: c - 1, row: r },
    { col: c, row: r + 1 },
    { col: c, row: r - 1 },
  ];
}

interface FloodFillContext {
  defaultFrame: number;
  height: number;
  map: TileLookup;
  queue: Array<TileCoord>;
  targetAnim: string | null;
  targetFrame: number;
  visited: Set<string>;
  width: number;
}

function exploreNeighbors(context: FloodFillContext, current: TileCoord): void {
  const neighbors = getAdjacentNeighbors(current.col, current.row);
  for (const n of neighbors) {
    const isValid = n.col >= 0 && n.col < context.width && n.row >= 0 && n.row < context.height;
    const nk = `${n.col},${n.row}`;
    if (isValid && !context.visited.has(nk)) {
      context.visited.add(nk);
      const tile = context.map.get(nk);
      if (shouldFillNeighbor(tile, context.defaultFrame, context.targetFrame, context.targetAnim)) {
        context.queue.push(n);
      }
    }
  }
}

function runFloodQueue(context: FloodFillContext, fillEntry: StoredTile): void {
  while (context.queue.length > 0) {
    const current = context.queue.shift();
    if (!current) {
      break;
    }
    context.map.set(`${current.col},${current.row}`, fillEntry);
    exploreNeighbors(context, current);
  }
}

export function performFloodFill(
  startCol: number,
  startRow: number,
  tileMap: TileLookup,
  width: number,
  height: number,
  defaultTileFrame: number,
  selectedTool: EditorTool,
): Array<HuntingLocationMapTile> | null {
  if (selectedTool.kind !== 'tile') {
    return null;
  }

  const startKey = `${startCol},${startRow}`;
  const startTile = tileMap.get(startKey);
  const targetFrame = startTile ? startTile.frame : defaultTileFrame;
  const targetAnim = startTile ? (startTile.animationId ?? null) : null;
  const fillFrame = selectedTool.frame;
  const fillAnim = selectedTool.animationId ?? null;

  if (targetFrame === fillFrame && targetAnim === fillAnim) {
    return null;
  }

  const newMap = new Map(tileMap);
  const visited = new Set<string>();
  const queue: Array<TileCoord> = [{ col: startCol, row: startRow }];
  visited.add(startKey);

  const context: FloodFillContext = {
    defaultFrame: defaultTileFrame,
    height,
    map: newMap,
    queue,
    targetAnim,
    targetFrame,
    visited,
    width,
  };

  const fillEntry: StoredTile = { animationId: fillAnim, frame: fillFrame };
  runFloodQueue(context, fillEntry);

  return exportTilesFromLookup(newMap, width, height);
}

export function extractStampFromMap(
  minCol: number,
  maxCol: number,
  minRow: number,
  maxRow: number,
  tileMap: TileLookup,
  defaultFrame: number,
): EditorTool {
  const stampTiles: Array<StampTile> = [];
  const w = maxCol - minCol + 1;
  const h = maxRow - minRow + 1;

  for (let r = minRow; r <= maxRow; r += 1) {
    for (let c = minCol; c <= maxCol; c += 1) {
      const entry = tileMap.get(`${c},${r}`);
      const item: StampTile = {
        animationId: entry ? entry.animationId : null,
        frame: entry ? entry.frame : defaultFrame,
        relX: c - minCol,
        relY: r - minRow,
      };
      stampTiles.push(item);
    }
  }

  return {
    height: h,
    kind: 'stamp',
    tiles: stampTiles,
    width: w,
  };
}

export function applyStampToMap(
  startCol: number,
  startRow: number,
  stamp: Extract<EditorTool, { kind: 'stamp' }>,
  tileMap: TileLookup,
  width: number,
  height: number,
): Array<HuntingLocationMapTile> {
  const nextMap = new Map(tileMap);
  for (const st of stamp.tiles) {
    const targetCol = startCol + st.relX;
    const targetRow = startRow + st.relY;
    if (targetCol >= 0 && targetCol < width && targetRow >= 0 && targetRow < height) {
      nextMap.set(`${targetCol},${targetRow}`, {
        animationId: st.animationId ?? null,
        frame: st.frame,
      });
    }
  }
  return exportTilesFromLookup(nextMap, width, height);
}
