import { expect, test } from 'bun:test';
import { inflateSync } from 'node:zlib';

import { createCanvas, crc32, encodePng, generateTiles, generateTrainer } from './gen-assets';

type Chunk = {
  data: Uint8Array;
  type: string;
};

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FRAME_WIDTH = 16;
const TRAINER_HEIGHT = 24;

test('o crc32 bate com o vetor conhecido do zlib', checkKnownCrc);
test('o png tem assinatura, chunks assinados e CRC em cada chunk', checkPngChunks);
test('os pixels codificados voltam iguais no IDAT', checkPngPixels);
test('gerar duas vezes produz os mesmos bytes', checkDeterminism);
test('o atlas de tiles cobre todos os ids e os frames animados', checkTilesAtlas);
test('o atlas do treinador tem 4 poses com idle 2 e walk 4', checkTrainerAtlas);
test('a pose left e o espelho exato da right', checkLeftMirror);
test('os pes de todas as poses encostam na base do sprite', checkFeetOnBase);

function checkKnownCrc(): void {
  expect(crc32(Uint8Array.from([49, 50, 51, 52, 53, 54, 55, 56, 57]))).toBe(0xcbf43926);
  expect(crc32(new Uint8Array(0))).toBe(0);
}

function checkPngChunks(): void {
  const canvas = createCanvas(2, 1);
  canvas.px(0, 0, 255, 0, 0, 255);
  canvas.px(1, 0, 0, 0, 255, 255);
  const png = encodePng(canvas);

  expect(Array.from(png.subarray(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));

  const chunks = readChunks(png);
  expect(chunks.map(readChunkType)).toEqual(['IHDR', 'IDAT', 'IEND']);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const typeBytes = Uint8Array.from(chunk.type, toCodePoint);
    const expected = crc32(concatBytes([typeBytes, chunk.data]));
    expect(readChunkCrc(png, index)).toBe(expected);
  }

  const header = new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset);
  expect(header.getUint32(0, false)).toBe(2);
  expect(header.getUint32(4, false)).toBe(1);
  expect(chunks[0].data[8]).toBe(8);
  expect(chunks[0].data[9]).toBe(6);
  expect(chunks[2].data.length).toBe(0);
}

function checkPngPixels(): void {
  const canvas = createCanvas(2, 1);
  canvas.px(0, 0, 255, 0, 0, 255);
  canvas.px(1, 0, 0, 0, 255, 255);

  const decoded = decodePng(encodePng(canvas));
  expect(decoded.width).toBe(2);
  expect(decoded.height).toBe(1);
  expect(Array.from(decoded.data)).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
}

function checkDeterminism(): void {
  const tiles = generateTiles();
  const trainer = generateTrainer();
  const secondTiles = generateTiles();
  const secondTrainer = generateTrainer();

  expectSameBytes(tiles.png, secondTiles.png);
  expectSameBytes(trainer.png, secondTrainer.png);
  expect(JSON.stringify(tiles.atlas)).toBe(JSON.stringify(secondTiles.atlas));
  expect(JSON.stringify(trainer.atlas)).toBe(JSON.stringify(secondTrainer.atlas));
}

function checkTilesAtlas(): void {
  const tiles = generateTiles();

  expect(tiles.atlas.meta.scale).toBe(1);
  expect(tiles.atlas.meta.image).toBe('tiles.png');
  expect(tiles.atlas.frames['tiles/0:0']).toBeDefined();
  expect(tiles.atlas.frames['tiles/4:0']).toBeDefined();
  expect(tiles.atlas.frames['tiles/4:1']).toBeDefined();
  expect(tiles.atlas.frames['tiles/3:1']).toBeDefined();
  expect(tiles.atlas.frames['tiles/9:0']).toBeDefined();
  expect(tiles.atlas.animations['tiles/4']).toHaveLength(2);
  expect(tiles.atlas.animations['tiles/3']).toHaveLength(2);

  for (const frame of Object.values(tiles.atlas.frames)) {
    expect(frame.frame.w).toBe(FRAME_WIDTH);
    expect(frame.frame.h).toBe(FRAME_WIDTH);
    expect(frame.sourceSize).toEqual({ h: FRAME_WIDTH, w: FRAME_WIDTH });
  }
}

function checkTrainerAtlas(): void {
  const trainer = generateTrainer();

  expect(trainer.atlas.meta.scale).toBe(1);
  expect(trainer.atlas.meta.image).toBe('trainer.png');
  expect(Object.keys(trainer.atlas.frames)).toHaveLength(24);
  expect(trainer.atlas.frames['trainer/right/0']).toBeDefined();
  expect(trainer.atlas.frames['trainer/left/5']).toBeDefined();

  for (const pose of ['up', 'down', 'right', 'left']) {
    expect(trainer.atlas.animations[`trainer/${pose}/idle`]).toHaveLength(2);
    expect(trainer.atlas.animations[`trainer/${pose}/walk`]).toHaveLength(4);
  }

  for (const frame of Object.values(trainer.atlas.frames)) {
    expect(frame.frame.w).toBe(FRAME_WIDTH);
    expect(frame.frame.h).toBe(TRAINER_HEIGHT);
  }
}

function checkLeftMirror(): void {
  const trainer = generateTrainer();
  const decoded = decodePng(trainer.png);
  const right = trainer.atlas.frames['trainer/right/0'].frame;
  const left = trainer.atlas.frames['trainer/left/0'].frame;

  for (let y = 0; y < TRAINER_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const rightPixel = readPixel(decoded, right.x + x, right.y + y);
      const leftPixel = readPixel(decoded, left.x + (FRAME_WIDTH - 1 - x), left.y + y);
      expect(Array.from(leftPixel)).toEqual(Array.from(rightPixel));
    }
  }
}

function checkFeetOnBase(): void {
  const trainer = generateTrainer();
  const decoded = decodePng(trainer.png);

  for (const frame of Object.values(trainer.atlas.frames)) {
    let bottom = 0;
    const row = frame.frame.y + TRAINER_HEIGHT - 1;
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      bottom += readPixel(decoded, frame.frame.x + x, row)[3];
    }
    expect(bottom).toBeGreaterThan(0);
  }
}

function readChunks(png: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset);
    const length = view.getUint32(0, false);
    const type = String.fromCodePoint(
      png[offset + 4],
      png[offset + 5],
      png[offset + 6],
      png[offset + 7],
    );
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({ data, type });
    offset += 12 + length;
  }
  return chunks;
}

function readChunkType(chunk: Chunk): string {
  return chunk.type;
}

function readChunkCrc(png: Uint8Array, chunkIndex: number): number {
  let offset = PNG_SIGNATURE.length;
  for (let index = 0; index < chunkIndex; index += 1) {
    const view = new DataView(png.buffer, png.byteOffset + offset);
    offset += 12 + view.getUint32(0, false);
  }
  const view = new DataView(png.buffer, png.byteOffset + offset);
  const length = view.getUint32(0, false);
  const crcOffset = offset + 8 + length;
  const crcView = new DataView(png.buffer, png.byteOffset + crcOffset);
  return crcView.getUint32(0, false);
}

function decodePng(png: Uint8Array): { data: Uint8Array; height: number; width: number } {
  const chunks = readChunks(png);
  const header = new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset);
  const width = header.getUint32(0, false);
  const height = header.getUint32(4, false);
  const compressed: Uint8Array[] = [];
  for (const chunk of chunks) {
    if (chunk.type === 'IDAT') {
      compressed.push(chunk.data);
    }
  }
  const raw = new Uint8Array(inflateSync(concatBytes(compressed)));
  const data = new Uint8Array(width * height * 4);
  const stride = width * 4 + 1;
  for (let row = 0; row < height; row += 1) {
    expect(raw[row * stride]).toBe(0);
    data.set(raw.subarray(row * stride + 1, (row + 1) * stride), row * width * 4);
  }
  return { data, height, width };
}

function readPixel(image: { data: Uint8Array; width: number }, x: number, y: number): Uint8Array {
  const index = (y * image.width + x) * 4;
  return image.data.subarray(index, index + 4);
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

function expectSameBytes(first: Uint8Array, second: Uint8Array): void {
  expect(first.length).toBe(second.length);
  for (let index = 0; index < first.length; index += 1) {
    expect(first[index]).toBe(second[index]);
  }
}

function toCodePoint(character: string): number {
  return character.codePointAt(0) ?? 0;
}
