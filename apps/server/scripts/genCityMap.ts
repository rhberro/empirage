/**
 * Regenerates the committed city map.
 *
 * The map is deterministic on purpose: the same script run anywhere yields
 * the same bytes, so the review of a map change is a diff, not a negotiation.
 * Run it with `bun run scripts/genCityMap.ts` from `apps/server` after
 * touching the layout below, and commit the JSON next to the contracts.
 */
import { TILE, isWalkableTile, tileAt, type CityMap, type TileId } from '@creatures/contracts';

const WIDTH = 96;
const HEIGHT = 64;
const BORDER = 2;
const OUTPUT = new URL('../../shared/contracts/city.json', import.meta.url);

type Rect = { h: number; w: number; x: number; y: number };

const tiles: TileId[] = Array.from({ length: WIDTH * HEIGHT }, function grass(): TileId {
  return TILE.GRASS;
});

function set(x: number, y: number, tile: TileId): void {
  if (x < BORDER || y < BORDER || x >= WIDTH - BORDER || y >= HEIGHT - BORDER) {
    return;
  }
  tiles[y * WIDTH + x] = tile;
}

function isGrass(x: number, y: number): boolean {
  const probe: CityMap = { height: HEIGHT, spawn: { x: 0, y: 0 }, tiles, width: WIDTH };
  return tileAt(probe, x, y) === TILE.GRASS;
}

function fill(rect: Rect, tile: TileId, onlyGrass = false): void {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (!onlyGrass || isGrass(x, y)) {
        set(x, y, tile);
      }
    }
  }
}

// The border is trees two deep: one tile of hedges reads as a fence, not a
// wall, and the second row keeps a diagonal from peeking over the edge.
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    if (x < BORDER || y < BORDER || x >= WIDTH - BORDER || y >= HEIGHT - BORDER) {
      tiles[y * WIDTH + x] = TILE.TREE;
    }
  }
}

// Roads cross the town and meet at the plaza; the spawn sits on the plaza.
fill({ h: 2, w: WIDTH - BORDER * 2, x: BORDER, y: 30 }, TILE.PATH);
fill({ h: 1, w: WIDTH - BORDER * 2, x: BORDER, y: 33 }, TILE.PATH);
fill({ h: HEIGHT - BORDER * 2, w: 2, x: 20, y: BORDER }, TILE.PATH);
fill({ h: HEIGHT - BORDER * 2, w: 2, x: 74, y: BORDER }, TILE.PATH);
fill({ h: 11, w: 9, x: 44, y: 27 }, TILE.PATH);

function placeHouse(origin: Rect): void {
  const doorX = origin.x + Math.floor(origin.w / 2);
  fill(origin, TILE.WALL);
  set(doorX, origin.y + origin.h - 1, TILE.DOOR);
}

placeHouse({ h: 6, w: 8, x: 26, y: 20 });
placeHouse({ h: 6, w: 8, x: 26, y: 40 });
placeHouse({ h: 6, w: 8, x: 64, y: 20 });
placeHouse({ h: 6, w: 8, x: 64, y: 40 });

// The lake eats the northeast corner; it is solid, so it shapes the roads.
for (let y = 1; y < 22; y += 1) {
  for (let x = 64; x < 94; x += 1) {
    const dx = (x - 79) / 12;
    const dy = (y - 9) / 8.5;
    if (dx * dx + dy * dy <= 1 && isGrass(x, y)) {
      set(x, y, TILE.WATER);
    }
  }
}

// Tall grass is the flavor of a hunting ground this town does not have yet;
// it is walkable and gives the future renderer an animated tile to carry.
fill({ h: 8, w: 9, x: 8, y: 6 }, TILE.TALL_GRASS, true);
fill({ h: 8, w: 9, x: 34, y: 50 }, TILE.TALL_GRASS, true);
fill({ h: 5, w: 5, x: 52, y: 44 }, TILE.TALL_GRASS, true);
fill({ h: 9, w: 9, x: 66, y: 48 }, TILE.TALL_GRASS, true);

// Trees and flowers are placed by arithmetic, not by an RNG: a rebuild never
// shakes the town around. Flowers happen on the whole lawn, trees only where
// an author listed a spot.
for (let y = BORDER; y < HEIGHT - BORDER; y += 1) {
  for (let x = BORDER; x < WIDTH - BORDER; x += 1) {
    if (isGrass(x, y) && (x * 7 + y * 13) % 29 === 0) {
      set(x, y, TILE.FLOWERS);
    }
  }
}

const TREE_SPOTS: Array<readonly [number, number]> = [
  [36, 8],
  [44, 8],
  [58, 8],
  [10, 26],
  [10, 34],
  [36, 26],
  [58, 26],
  [14, 48],
  [14, 56],
  [40, 34],
  [70, 36],
  [88, 30],
  [88, 44],
  [88, 52],
  [30, 30],
  [66, 30],
];
for (const [x, y] of TREE_SPOTS) {
  set(x, y, TILE.TREE);
}

set(52, 29, TILE.WELL);

const cityMap: CityMap = {
  height: HEIGHT,
  name: 'Cidade Primavera',
  spawn: { x: 48, y: 31 },
  tiles,
  width: WIDTH,
};

if (!isWalkableTile(cityMap, cityMap.spawn)) {
  throw new Error(`spawn ${JSON.stringify(cityMap.spawn)} is not walkable`);
}

const rows: string[] = [];
for (let y = 0; y < HEIGHT; y += 1) {
  rows.push(JSON.stringify(tiles.slice(y * WIDTH, (y + 1) * WIDTH)));
}

function indentRow(row: string): string {
  return `    ${row}`;
}

// The body of the map is written row by row, so a layout change reads as a
// vertical diff instead of one six-thousand-number line.
const body = `{
  "name": ${JSON.stringify(cityMap.name)},
  "width": ${cityMap.width},
  "height": ${cityMap.height},
  "spawn": { "x": ${cityMap.spawn.x}, "y": ${cityMap.spawn.y} },
  "tiles": [
${rows.map(indentRow).join(',\n')}
  ]
}
`;
await Bun.write(OUTPUT, body);
globalThis.console.log(
  `wrote ${OUTPUT.pathname} (${WIDTH}x${HEIGHT}, spawn ${cityMap.spawn.x},${cityMap.spawn.y})`,
);
