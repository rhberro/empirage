/* eslint-disable max-lines */
/**
 * Gera os assets procedurais do mundo em `public/world/`.
 *
 * Os assets sao procedurais por enquanto (D5): trocar por arte real e
 * sobrescrever os PNGs, o contrato do atlas continua o mesmo. O gerador e
 * deterministico — sem RNG, todo padrao e uma regra aritmetica fixa e o
 * deflate do zlib e estavel para a mesma entrada —, entao um rebuild so
 * produz diff quando a arte muda.
 *
 * O encoder PNG mora aqui de proposito: canvas/sharp colocariam um build
 * nativo na toolchain do cliente por duas imagens pequenas. RGBA de 8 bits
 * mais o stream IDAT do `node:zlib` e tudo que esses sprites precisam.
 *
 * Run: `bun run scripts/gen-assets.ts` em `apps/client`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

import { TILE, TILE_META, type TileId } from '@creatures/contracts';

const TILE_SIZE = 16;
const TRAINER_HEIGHT = 24;
const TRAINER_WIDTH = 16;
const OUTPUT_DIRECTORY = path.join(import.meta.dirname, '../public/world');

type Rgba = readonly [number, number, number, number];

interface Canvas {
  data: Uint8Array;
  height: number;
  width: number;
  blit(source: Canvas, x: number, y: number): void;
  fill(x: number, y: number, width: number, height: number, color: Rgba): void;
  mirror(): Canvas;
  outline(color: Rgba): void;
  px(x: number, y: number, r: number, g: number, b: number, a?: number): void;
}

type AtlasFrame = {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  sourceSize: { w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  trimmed: boolean;
};

type AtlasMeta = {
  app: string;
  format: string;
  image: string;
  scale: number;
  size: { w: number; h: number };
};

type Spritesheet = {
  animations: Record<string, string[]>;
  frames: Record<string, AtlasFrame>;
  meta: AtlasMeta;
};

export type GeneratedAsset = {
  atlas: Spritesheet;
  png: Uint8Array;
};

/* -------------------------------------------------------------------------- */
/* Cores                                                                      */
/* -------------------------------------------------------------------------- */

const OUTLINE: Rgba = [26, 22, 34, 255];

const GRASS_BASE: Rgba = [84, 154, 66, 255];
const GRASS_DARK: Rgba = [58, 122, 52, 255];
const GRASS_LIGHT: Rgba = [112, 182, 80, 255];

const PATH_BASE: Rgba = [198, 172, 112, 255];
const PATH_DARK: Rgba = [170, 142, 88, 255];
const PATH_LIGHT: Rgba = [220, 196, 140, 255];

const FLOWER_RED: Rgba = [214, 74, 86, 255];
const FLOWER_WHITE: Rgba = [244, 240, 232, 255];
const FLOWER_YELLOW: Rgba = [240, 214, 90, 255];
const FLOWER_PURPLE: Rgba = [168, 108, 208, 255];

const TALL_BASE: Rgba = [50, 128, 68, 255];
const TALL_DARK: Rgba = [34, 102, 54, 255];
const TALL_LIGHT: Rgba = [98, 180, 96, 255];

const WATER_BASE: Rgba = [64, 130, 190, 255];
const WATER_DEEP: Rgba = [42, 96, 152, 255];
const WATER_LIGHT: Rgba = [116, 182, 228, 255];

const WOOD: Rgba = [152, 98, 54, 255];
const WOOD_DARK: Rgba = [112, 70, 40, 255];

const BRICK: Rgba = [158, 86, 70, 255];
const BRICK_DARK: Rgba = [126, 64, 52, 255];
const MORTAR: Rgba = [208, 178, 150, 255];

const STONE: Rgba = [154, 154, 160, 255];
const STONE_DARK: Rgba = [108, 110, 120, 255];

const CANOPY: Rgba = [46, 118, 62, 255];
const CANOPY_DARK: Rgba = [32, 88, 48, 255];
const CANOPY_LIGHT: Rgba = [80, 156, 82, 255];
const TRUNK: Rgba = [116, 76, 44, 255];

const SKIN: Rgba = [236, 188, 148, 255];
const SKIN_SHADE: Rgba = [204, 156, 120, 255];
const HAIR: Rgba = [92, 58, 44, 255];
const HAIR_LIGHT: Rgba = [128, 84, 58, 255];
const SHIRT: Rgba = [206, 78, 66, 255];
const SHIRT_DARK: Rgba = [168, 54, 56, 255];
const PANTS: Rgba = [64, 82, 142, 255];
const PANTS_DARK: Rgba = [46, 58, 106, 255];
const SHOE: Rgba = [58, 46, 42, 255];
const BACKPACK: Rgba = [184, 140, 76, 255];
const BACKPACK_LIGHT: Rgba = [216, 178, 112, 255];
const STRAP: Rgba = [70, 46, 34, 255];

const FLOWER_PETALS: readonly Rgba[] = [FLOWER_RED, FLOWER_WHITE, FLOWER_YELLOW, FLOWER_PURPLE];

/* -------------------------------------------------------------------------- */
/* Canvas                                                                     */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line max-lines-per-function
export function createCanvas(width: number, height: number): Canvas {
  const data = new Uint8Array(width * height * 4);

  function indexOf(x: number, y: number): number {
    return (y * width + x) * 4;
  }

  function px(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const index = indexOf(x, y);
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
  }

  function fill(x: number, y: number, fillWidth: number, fillHeight: number, color: Rgba): void {
    const red = color[0];
    const green = color[1];
    const blue = color[2];
    const alpha = color[3];
    for (let row = y; row < y + fillHeight; row += 1) {
      for (let column = x; column < x + fillWidth; column += 1) {
        px(column, row, red, green, blue, alpha);
      }
    }
  }

  function blit(source: Canvas, x: number, y: number): void {
    for (let row = 0; row < source.height; row += 1) {
      for (let column = 0; column < source.width; column += 1) {
        const sourceIndex = (row * source.width + column) * 4;
        const alpha = source.data[sourceIndex + 3];
        if (alpha === 0) {
          continue;
        }
        px(
          x + column,
          y + row,
          source.data[sourceIndex],
          source.data[sourceIndex + 1],
          source.data[sourceIndex + 2],
          alpha,
        );
      }
    }
  }

  function mirror(): Canvas {
    const mirrored = createCanvas(width, height);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const sourceIndex = indexOf(width - 1 - column, row);
        mirrored.px(
          column,
          row,
          data[sourceIndex],
          data[sourceIndex + 1],
          data[sourceIndex + 2],
          data[sourceIndex + 3],
        );
      }
    }
    return mirrored;
  }

  function outline(color: Rgba): void {
    const opaque = new Uint8Array(width * height);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        opaque[row * width + column] = data[indexOf(column, row) + 3];
      }
    }
    function touchesOpaque(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return false;
      }
      return opaque[y * width + x] > 0;
    }
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        if (opaque[row * width + column] > 0) {
          continue;
        }
        const near =
          touchesOpaque(column - 1, row) ||
          touchesOpaque(column + 1, row) ||
          touchesOpaque(column, row - 1) ||
          touchesOpaque(column, row + 1);
        if (near) {
          px(column, row, color[0], color[1], color[2], color[3]);
        }
      }
    }
  }

  const canvas: Canvas = { blit, data, fill, height, mirror, outline, px, width };
  return canvas;
}

function paint(canvas: Canvas, x: number, y: number, color: Rgba): void {
  canvas.px(x, y, color[0], color[1], color[2], color[3]);
}

/* -------------------------------------------------------------------------- */
/* PNG                                                                        */
/* -------------------------------------------------------------------------- */

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = buildCrcTable();

/* eslint-disable no-bitwise */
function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/* eslint-enable no-bitwise */

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value, false);
  return bytes;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(type, function toCodePoint(character: string): number {
    return character.codePointAt(0) ?? 0;
  });
  const crc = crc32(concatBytes([typeBytes, payload]));
  return concatBytes([uint32(payload.length), typeBytes, payload, uint32(crc)]);
}

export function encodePng(canvas: Canvas): Uint8Array {
  const stride = canvas.width * 4 + 1;
  const raw = new Uint8Array(stride * canvas.height);
  for (let row = 0; row < canvas.height; row += 1) {
    raw[row * stride] = 0;
    raw.set(
      canvas.data.subarray(row * canvas.width * 4, (row + 1) * canvas.width * 4),
      row * stride + 1,
    );
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, canvas.width, false);
  view.setUint32(4, canvas.height, false);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const idat = new Uint8Array(deflateSync(raw, { level: 9 }));
  const end = new Uint8Array(0);
  return concatBytes([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', idat),
    pngChunk('IEND', end),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Atlas                                                                      */
/* -------------------------------------------------------------------------- */

function atlasFrame(x: number, y: number, width: number, height: number): AtlasFrame {
  const frame = { h: height, w: width, x, y };
  const size = { h: height, w: width };
  const origin = { h: height, w: width, x: 0, y: 0 };
  return { frame, rotated: false, sourceSize: size, spriteSourceSize: origin, trimmed: false };
}

function atlasMeta(image: string, width: number, height: number): AtlasMeta {
  const size = { h: height, w: width };
  return { app: 'creatures-gen-assets', format: 'RGBA8888', image, scale: 1, size };
}

/* -------------------------------------------------------------------------- */
/* Tiles                                                                      */
/* -------------------------------------------------------------------------- */

type TilePainter = (canvas: Canvas, frame: number) => void;

function ditherSeed(x: number, y: number): number {
  return (x * 13 + y * 7) % 23;
}

function paintGrass(canvas: Canvas): void {
  canvas.fill(0, 0, TILE_SIZE, TILE_SIZE, GRASS_BASE);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const seed = ditherSeed(x, y);
      if (seed === 0) {
        paint(canvas, x, y, GRASS_LIGHT);
      }
      if (seed === 7) {
        paint(canvas, x, y, GRASS_DARK);
      }
    }
  }
}

function paintPath(canvas: Canvas): void {
  canvas.fill(0, 0, TILE_SIZE, TILE_SIZE, PATH_BASE);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const seed = ditherSeed(x, y);
      if (seed === 3) {
        paint(canvas, x, y, PATH_DARK);
      }
      if (seed === 11) {
        paint(canvas, x, y, PATH_LIGHT);
      }
    }
  }
}

const FLOWER_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [11, 3],
  [6, 11],
  [12, 12],
  [9, 8],
];

function paintFlowers(canvas: Canvas): void {
  paintGrass(canvas);
  for (let index = 0; index < FLOWER_SPOTS.length; index += 1) {
    const spot = FLOWER_SPOTS[index];
    const petals = FLOWER_PETALS[index % FLOWER_PETALS.length];
    const [x, y] = spot;
    paint(canvas, x, y - 1, petals);
    paint(canvas, x - 1, y, petals);
    paint(canvas, x + 1, y, petals);
    paint(canvas, x, y + 1, petals);
    paint(canvas, x, y, FLOWER_YELLOW);
  }
}

const TALL_GRASS_TUFTS: ReadonlyArray<readonly [number, number]> = [
  [3, 4],
  [7, 2],
  [11, 6],
  [5, 11],
  [13, 11],
  [9, 13],
];

function paintTallGrass(canvas: Canvas, frame: number): void {
  canvas.fill(0, 0, TILE_SIZE, TILE_SIZE, TALL_BASE);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const seed = ditherSeed(x, y);
      if (seed === 5) {
        paint(canvas, x, y, TALL_DARK);
      }
      if (seed === 13) {
        paint(canvas, x, y, TALL_LIGHT);
      }
    }
  }
  for (const tuft of TALL_GRASS_TUFTS) {
    const [x, y] = tuft;
    const sway = frame % 2;
    paint(canvas, x, y + sway, TALL_LIGHT);
    paint(canvas, x, y + sway + 1, TALL_LIGHT);
    paint(canvas, x, y + sway + 2, TALL_DARK);
    paint(canvas, x + 1, y + sway + 1, TALL_LIGHT);
    paint(canvas, x - 1, y + sway + 2, TALL_LIGHT);
    paint(canvas, x - 1, y + sway + 3, TALL_DARK);
  }
}

function paintWater(canvas: Canvas, frame: number): void {
  canvas.fill(0, 0, TILE_SIZE, TILE_SIZE, WATER_BASE);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const phase = (x + y * 3 + frame) % 17;
      if (phase === 2) {
        paint(canvas, x, y, WATER_DEEP);
      }
      if (phase === 9) {
        paint(canvas, x, y, WATER_LIGHT);
      }
    }
  }
  const waveRows: readonly number[] = [3, 8, 13];
  for (const row of waveRows) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if ((x + frame + row) % 6 < 2) {
        paint(canvas, x, row, WATER_LIGHT);
        paint(canvas, x, row + 1, WATER_DEEP);
      }
    }
  }
}

function paintFence(canvas: Canvas): void {
  paintGrass(canvas);
  canvas.fill(0, 4, TILE_SIZE, 3, WOOD);
  canvas.fill(0, 11, TILE_SIZE, 3, WOOD);
  for (let x = 0; x < TILE_SIZE; x += 1) {
    paint(canvas, x, 7, WOOD_DARK);
    paint(canvas, x, 14, WOOD_DARK);
  }
  canvas.fill(2, 2, 3, 13, WOOD);
  canvas.fill(11, 2, 3, 13, WOOD);
  paint(canvas, 2, 2, WOOD_DARK);
  paint(canvas, 4, 2, WOOD_DARK);
  paint(canvas, 11, 2, WOOD_DARK);
  paint(canvas, 13, 2, WOOD_DARK);
  for (let y = 3; y < 15; y += 1) {
    paint(canvas, 2, y, WOOD_DARK);
    paint(canvas, 13, y, WOOD_DARK);
  }
}

function paintWall(canvas: Canvas): void {
  canvas.fill(0, 0, TILE_SIZE, TILE_SIZE, MORTAR);
  for (let row = 0; row < 4; row += 1) {
    const top = row * 4;
    const offset = row % 2 === 0 ? 0 : 4;
    for (let x = offset - 8; x < TILE_SIZE; x += 8) {
      canvas.fill(x, top, 7, 3, BRICK);
      paint(canvas, x, top, BRICK_DARK);
      paint(canvas, x + 6, top + 1, BRICK_DARK);
    }
  }
}

function paintDoor(canvas: Canvas): void {
  paintWall(canvas);
  canvas.fill(3, 1, 10, 15, WOOD_DARK);
  canvas.fill(4, 2, 8, 14, WOOD);
  canvas.fill(6, 2, 1, 14, WOOD_DARK);
  canvas.fill(9, 2, 1, 14, WOOD_DARK);
  canvas.fill(5, 3, 1, 12, WOOD_DARK);
  canvas.fill(10, 3, 1, 12, WOOD_DARK);
  paint(canvas, 10, 9, FLOWER_YELLOW);
  paint(canvas, 10, 10, FLOWER_YELLOW);
  paint(canvas, 9, 9, WOOD_DARK);
}

const TREE_ROWS: readonly number[] = [2, 3, 4, 4, 4, 4, 4, 3, 3, 2];

function paintTree(canvas: Canvas): void {
  paintGrass(canvas);
  canvas.fill(7, 11, 3, 4, TRUNK);
  paint(canvas, 7, 11, WOOD_DARK);
  paint(canvas, 9, 11, WOOD_DARK);
  for (let index = 0; index < TREE_ROWS.length; index += 1) {
    const y = 1 + index;
    const half = TREE_ROWS[index];
    canvas.fill(8 - half - 1, y, half * 2 + 2, 1, CANOPY_DARK);
    canvas.fill(8 - half, y, half * 2, 1, CANOPY);
    paint(canvas, 8 - half + 1, y, CANOPY_LIGHT);
    paint(canvas, 8 + half - 2, y, CANOPY_LIGHT);
  }
  for (let y = 1; y < 11; y += 1) {
    for (let x = 2; x < 14; x += 1) {
      if (ditherSeed(x, y) === 0) {
        paint(canvas, x, y, CANOPY_LIGHT);
      }
    }
  }
}

const WELL_ROWS: readonly number[] = [3, 4, 5, 5, 5, 5, 5, 4, 3];

function paintWell(canvas: Canvas): void {
  paintGrass(canvas);
  for (let index = 0; index < WELL_ROWS.length; index += 1) {
    const y = 2 + index;
    const half = WELL_ROWS[index];
    canvas.fill(8 - half, y, half * 2, 1, STONE);
    paint(canvas, 8 - half, y, STONE_DARK);
    paint(canvas, 7 + half, y, STONE_DARK);
  }
  for (let index = 1; index < WELL_ROWS.length - 1; index += 1) {
    const y = 2 + index;
    const half = WELL_ROWS[index] - 2;
    canvas.fill(8 - half, y, half * 2, 1, WATER_DEEP);
  }
  paint(canvas, 8, 6, WATER_LIGHT);
  paint(canvas, 9, 7, WATER_LIGHT);
}

const TILE_PAINTERS: Record<string, TilePainter> = {
  DOOR: paintDoor,
  FENCE: paintFence,
  FLOWERS: paintFlowers,
  GRASS: paintGrass,
  PATH: paintPath,
  TALL_GRASS: paintTallGrass,
  TREE: paintTree,
  WALL: paintWall,
  WATER: paintWater,
  WELL: paintWell,
};

const TILE_COLUMNS = 4;

type TileFrameSpec = {
  frame: number;
  id: TileId;
  name: string;
};

function tileIdOf(name: string): TileId {
  return TILE[name as keyof typeof TILE];
}

function compareTileNames(first: string, second: string): number {
  return tileIdOf(first) - tileIdOf(second);
}

function listTileFrames(): TileFrameSpec[] {
  const names = Object.keys(TILE).toSorted(compareTileNames);
  const specs: TileFrameSpec[] = [];
  for (const name of names) {
    const id = tileIdOf(name);
    const count = TILE_META[id].frames ?? 1;
    for (let frame = 0; frame < count; frame += 1) {
      specs.push({ frame, id, name });
    }
  }
  return specs;
}

export function generateTiles(): GeneratedAsset {
  const specs = listTileFrames();
  const rows = Math.ceil(specs.length / TILE_COLUMNS);
  const sheet = createCanvas(TILE_COLUMNS * TILE_SIZE, rows * TILE_SIZE);
  const frames: Record<string, AtlasFrame> = {};
  const animations: Record<string, string[]> = {};
  const animationFrames: Record<string, string[]> = {};

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const column = index % TILE_COLUMNS;
    const row = Math.floor(index / TILE_COLUMNS);
    const x = column * TILE_SIZE;
    const y = row * TILE_SIZE;
    const sprite = createCanvas(TILE_SIZE, TILE_SIZE);
    TILE_PAINTERS[spec.name](sprite, spec.frame);
    sheet.blit(sprite, x, y);
    const key = `tiles/${spec.id}:${spec.frame}`;
    frames[key] = atlasFrame(x, y, TILE_SIZE, TILE_SIZE);
    const animationKey = `tiles/${spec.id}`;
    animationFrames[animationKey] ??= [];
    animationFrames[animationKey].push(key);
  }

  for (const animationKey of Object.keys(animationFrames)) {
    const keys = animationFrames[animationKey];
    if (keys.length > 1) {
      animations[animationKey] = keys;
    }
  }

  return {
    atlas: { animations, frames, meta: atlasMeta('tiles.png', sheet.width, sheet.height) },
    png: encodePng(sheet),
  };
}

/* -------------------------------------------------------------------------- */
/* Treinador                                                                  */
/* -------------------------------------------------------------------------- */

type TrainerPose = 'up' | 'down' | 'right' | 'left';

const TRAINER_POSES: readonly TrainerPose[] = ['up', 'down', 'right', 'left'];
const TRAINER_COLUMNS = 6;
const WALK_STRIDE: readonly number[] = [-1, 0, 1, 0];
const WALK_ARM_SHIFT: readonly number[] = [1, 0, -1, 0];

type TrainerMotion = {
  armShift: number;
  blink: boolean;
  stride: number;
};

function drawTrainerArms(canvas: Canvas, armShift: number): void {
  canvas.fill(2, 9 + armShift, 2, 5, SHIRT_DARK);
  canvas.fill(12, 9 - armShift, 2, 5, SHIRT_DARK);
  canvas.fill(2, 14 + armShift, 2, 2, SKIN);
  canvas.fill(12, 14 - armShift, 2, 2, SKIN);
  paint(canvas, 2, 9 + armShift, SHIRT);
  paint(canvas, 13, 9 - armShift, SHIRT);
}

function drawTrainerLegs(canvas: Canvas, stride: number): void {
  const leftLift = stride > 0 ? 2 : 0;
  const rightLift = stride < 0 ? 2 : 0;
  const leftHeight = 6 - leftLift;
  const rightHeight = 6 - rightLift;

  canvas.fill(4, 16, 3, leftHeight, PANTS);
  canvas.fill(9, 16, 3, rightHeight, PANTS);
  paint(canvas, 4, 16, PANTS_DARK);
  paint(canvas, 11, 16, PANTS_DARK);
  canvas.fill(3, 16 + leftHeight, 5, 2, SHOE);
  canvas.fill(8, 16 + rightHeight, 5, 2, SHOE);
}

function drawTrainerHeadDown(canvas: Canvas, blink: boolean): void {
  canvas.fill(5, 2, 6, 2, HAIR);
  canvas.fill(4, 3, 8, 2, HAIR);
  canvas.fill(5, 4, 6, 4, SKIN);
  canvas.fill(4, 4, 1, 3, HAIR);
  canvas.fill(11, 4, 1, 3, HAIR);
  canvas.fill(5, 3, 6, 1, HAIR_LIGHT);
  if (!blink) {
    paint(canvas, 6, 6, OUTLINE);
    paint(canvas, 9, 6, OUTLINE);
  }
  paint(canvas, 7, 7, SKIN_SHADE);
  paint(canvas, 8, 7, SKIN_SHADE);
  canvas.fill(6, 8, 4, 1, SKIN);
}

function drawTrainerHeadUp(canvas: Canvas): void {
  canvas.fill(5, 2, 6, 2, HAIR);
  canvas.fill(4, 4, 8, 3, HAIR);
  canvas.fill(5, 7, 6, 1, HAIR);
  canvas.fill(5, 3, 6, 1, HAIR_LIGHT);
  paint(canvas, 4, 6, SKIN);
  paint(canvas, 11, 6, SKIN);
  canvas.fill(6, 8, 4, 1, SKIN);
}

function drawTrainerFront(canvas: Canvas, motion: TrainerMotion): void {
  drawTrainerHeadDown(canvas, motion.blink);
  canvas.fill(4, 9, 8, 7, SHIRT);
  canvas.fill(6, 9, 4, 1, SHIRT_DARK);
  canvas.fill(10, 10, 2, 6, SHIRT_DARK);
  drawTrainerArms(canvas, motion.armShift);
  drawTrainerLegs(canvas, motion.stride);
}

function drawTrainerBack(canvas: Canvas, motion: TrainerMotion): void {
  drawTrainerHeadUp(canvas);
  canvas.fill(4, 9, 8, 7, SHIRT);
  canvas.fill(11, 9, 1, 7, SHIRT_DARK);
  canvas.fill(6, 10, 4, 4, BACKPACK);
  canvas.fill(6, 10, 4, 1, BACKPACK_LIGHT);
  paint(canvas, 9, 13, STRAP);
  canvas.fill(5, 9, 1, 6, STRAP);
  canvas.fill(10, 9, 1, 6, STRAP);
  drawTrainerArms(canvas, motion.armShift);
  drawTrainerLegs(canvas, motion.stride);
}

function drawTrainerHeadRight(canvas: Canvas, blink: boolean): void {
  canvas.fill(4, 2, 7, 2, HAIR);
  canvas.fill(4, 3, 8, 2, HAIR);
  canvas.fill(4, 4, 3, 4, HAIR);
  canvas.fill(7, 4, 4, 4, SKIN);
  paint(canvas, 10, 3, HAIR);
  paint(canvas, 11, 6, SKIN);
  paint(canvas, 11, 7, SKIN_SHADE);
  paint(canvas, 7, 6, SKIN_SHADE);
  if (!blink) {
    paint(canvas, 10, 6, OUTLINE);
  }
  canvas.fill(7, 8, 3, 1, SKIN);
}

function drawTrainerProfile(canvas: Canvas, motion: TrainerMotion): void {
  drawTrainerHeadRight(canvas, motion.blink);
  canvas.fill(4, 9, 7, 7, SHIRT);
  canvas.fill(9, 9, 2, 7, SHIRT_DARK);
  canvas.fill(7, 10 + motion.armShift, 3, 5, SHIRT_DARK);
  canvas.fill(8, 14 + motion.armShift, 2, 2, SKIN);
  canvas.fill(3, 10 - motion.armShift, 2, 5, SHIRT_DARK);
  canvas.fill(3, 14 - motion.armShift, 2, 2, SKIN);

  const frontLift = motion.stride < 0 ? 2 : 0;
  const backLift = motion.stride > 0 ? 2 : 0;
  const frontHeight = 6 - frontLift;
  const backHeight = 6 - backLift;
  const frontShoeX = frontLift > 0 ? 6 : 7;
  const backShoeX = backLift > 0 ? 2 : 3;
  canvas.fill(4, 16, 3, backHeight, PANTS);
  canvas.fill(7, 16, 3, frontHeight, PANTS);
  paint(canvas, 4, 16, PANTS_DARK);
  paint(canvas, 9, 16, PANTS_DARK);
  canvas.fill(backShoeX, 16 + backHeight, 4, 2, SHOE);
  canvas.fill(frontShoeX, 16 + frontHeight, 4, 2, SHOE);
}

function resolveTrainerMotion(pose: TrainerPose, frame: number): TrainerMotion {
  if (frame < 2) {
    const blink = frame === 1 && (pose === 'down' || pose === 'right');
    const armShift = frame === 1 && pose === 'up' ? 1 : 0;
    return { armShift, blink, stride: 0 };
  }
  const phase = frame - 2;
  return { armShift: WALK_ARM_SHIFT[phase], blink: false, stride: WALK_STRIDE[phase] };
}

function createTrainerSprite(pose: TrainerPose, frame: number): Canvas {
  if (pose === 'left') {
    return createTrainerSprite('right', frame).mirror();
  }
  const sprite = createCanvas(TRAINER_WIDTH, TRAINER_HEIGHT);
  const motion = resolveTrainerMotion(pose, frame);
  if (pose === 'down') {
    drawTrainerFront(sprite, motion);
  }
  if (pose === 'up') {
    drawTrainerBack(sprite, motion);
  }
  if (pose === 'right') {
    drawTrainerProfile(sprite, motion);
  }
  sprite.outline(OUTLINE);
  return sprite;
}

function trainerFrameKey(pose: TrainerPose, frame: number): string {
  return `trainer/${pose}/${frame}`;
}

export function generateTrainer(): GeneratedAsset {
  const rows = TRAINER_POSES.length;
  const sheet = createCanvas(TRAINER_COLUMNS * TRAINER_WIDTH, rows * TRAINER_HEIGHT);
  const frames: Record<string, AtlasFrame> = {};
  const animations: Record<string, string[]> = {};

  for (let poseIndex = 0; poseIndex < TRAINER_POSES.length; poseIndex += 1) {
    const pose = TRAINER_POSES[poseIndex];
    const idleKeys: string[] = [];
    const walkKeys: string[] = [];
    for (let frame = 0; frame < TRAINER_COLUMNS; frame += 1) {
      const column = frame;
      const x = column * TRAINER_WIDTH;
      const y = poseIndex * TRAINER_HEIGHT;
      const sprite = createTrainerSprite(pose, frame);
      sheet.blit(sprite, x, y);
      const key = trainerFrameKey(pose, frame);
      frames[key] = atlasFrame(x, y, TRAINER_WIDTH, TRAINER_HEIGHT);
      const target = frame < 2 ? idleKeys : walkKeys;
      target.push(key);
    }
    animations[`trainer/${pose}/idle`] = idleKeys;
    animations[`trainer/${pose}/walk`] = walkKeys;
  }

  return {
    atlas: {
      animations,
      frames,
      meta: atlasMeta('trainer.png', sheet.width, sheet.height),
    },
    png: encodePng(sheet),
  };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

function writeAsset(name: string, asset: GeneratedAsset): void {
  const pngPath = path.join(OUTPUT_DIRECTORY, name.replace('.json', '.png'));
  const jsonPath = path.join(OUTPUT_DIRECTORY, name);
  writeFileSync(pngPath, asset.png);
  writeFileSync(jsonPath, `${JSON.stringify(asset.atlas, null, 2)}\n`);
}

function main(): void {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const tiles = generateTiles();
  const trainer = generateTrainer();
  writeAsset('tiles.json', tiles);
  writeAsset('trainer.json', trainer);
  process.stdout.write(
    `world assets: tiles ${tiles.png.length} bytes, trainer ${trainer.png.length} bytes\n`,
  );
}

if (import.meta.main) {
  main();
}
