/* eslint-disable max-lines, no-bitwise */
/**
 * Regenerates the committed area maps.
 *
 * The maps are deterministic on purpose: the same script run anywhere yields
 * the same bytes, so reviewing an area is reading a diff. Run it with
 * `bun run scripts/genHuntMaps.ts` from `apps/server` and commit the JSONs
 * next to the contracts.
 */
import {
  readHuntMap,
  validateHuntMap,
  type HuntMap,
  type HuntMapSource,
  type HuntMapSpawn,
} from '@creatures/contracts/huntMap';
import { TILE, isWalkableTile, type Tile, type TileId } from '@creatures/contracts/world';

const WIDTH = 96;
const HEIGHT = 64;
const BORDER = 2;
const CORRIDOR_RADIUS = 1;
const START_CLEARING_RADIUS = 3;
const START_RING_RADIUS = 4;
const CLUSTER_RADIUS = 2;
const MIN_SPAWN_DISTANCE = 10;
const MIN_CLUSTER_DISTANCE = 6;
const FLOWER_RATE = 0.06;
const TALL_GRASS_RATE = 0.08;
const OUTPUT_DIR = new URL('../../shared/contracts/hunts/', import.meta.url);

type RectObstacle = {
  height: number;
  kind: 'rect';
  tile: TileId;
  width: number;
  x: number;
  y: number;
};

type DiscObstacle = {
  kind: 'disc';
  radius: number;
  tile: TileId;
  x: number;
  y: number;
};

type EllipseObstacle = {
  kind: 'ellipse';
  radiusX: number;
  radiusY: number;
  tile: TileId;
  x: number;
  y: number;
};

type Obstacle = RectObstacle | DiscObstacle | EllipseObstacle;

type Cluster = {
  offsets: Tile[];
  x: number;
  y: number;
};

type AreaDefinition = {
  clusters: Cluster[];
  levelMax: number;
  levelMin: number;
  name: string;
  obstacles: Obstacle[];
  respawnMs: number;
  slug: string;
  species: string[];
  start: Tile;
  waypoints: Tile[];
};

const TILE_FOR_OBSTACLE = {
  grove: TILE.TREE,
  ice: TILE.WALL,
  lake: TILE.WATER,
  rubble: TILE.TREE,
  ruins: TILE.WALL,
} as const satisfies Record<string, TileId>;

const OFFSETS_TRIO: Tile[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

const OFFSETS_QUAD: Tile[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

const NEIGHBOURS: Tile[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

function rect(tile: TileId, x: number, y: number, width: number, height: number): RectObstacle {
  return { height, kind: 'rect', tile, width, x, y };
}

function disc(tile: TileId, x: number, y: number, radius: number): DiscObstacle {
  return { kind: 'disc', radius, tile, x, y };
}

function ellipse(
  tile: TileId,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
): EllipseObstacle {
  return { kind: 'ellipse', radiusX, radiusY, tile, x, y };
}

const AREAS: AreaDefinition[] = [
  {
    clusters: [
      { offsets: OFFSETS_TRIO, x: 56, y: 34 },
      { offsets: OFFSETS_TRIO, x: 28, y: 34 },
      { offsets: OFFSETS_TRIO, x: 48, y: 22 },
      { offsets: OFFSETS_TRIO, x: 34, y: 44 },
    ],
    levelMax: 3,
    levelMin: 1,
    name: 'Campina Cinzenta',
    obstacles: [
      disc(TILE_FOR_OBSTACLE.lake, 48, 38, 4),
      rect(TILE_FOR_OBSTACLE.grove, 6, 10, 8, 6),
      rect(TILE_FOR_OBSTACLE.grove, 82, 8, 6, 10),
      rect(TILE_FOR_OBSTACLE.grove, 80, 48, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 14, 20, 4, 3),
      rect(TILE_FOR_OBSTACLE.ruins, 62, 42, 5, 3),
    ],
    respawnMs: 30_000,
    slug: 'campina-cinzenta',
    species: ['brasa', 'broto', 'pedrino', 'cinzarra'],
    start: { x: 76, y: 50 },
    waypoints: [
      { x: 76, y: 50 },
      { x: 76, y: 36 },
      { x: 66, y: 26 },
      { x: 66, y: 16 },
      { x: 50, y: 16 },
      { x: 50, y: 26 },
      { x: 36, y: 26 },
      { x: 36, y: 14 },
      { x: 20, y: 14 },
      { x: 20, y: 30 },
      { x: 12, y: 30 },
      { x: 12, y: 48 },
      { x: 26, y: 48 },
      { x: 26, y: 56 },
      { x: 44, y: 56 },
      { x: 44, y: 46 },
      { x: 58, y: 46 },
      { x: 58, y: 54 },
      { x: 70, y: 54 },
    ],
  },
  {
    clusters: [
      { offsets: OFFSETS_TRIO, x: 40, y: 50 },
      { offsets: OFFSETS_TRIO, x: 56, y: 50 },
      { offsets: OFFSETS_TRIO, x: 22, y: 32 },
      { offsets: OFFSETS_TRIO, x: 72, y: 32 },
      { offsets: OFFSETS_TRIO, x: 48, y: 14 },
    ],
    levelMax: 7,
    levelMin: 5,
    name: 'Lago Congelado',
    obstacles: [
      ellipse(TILE_FOR_OBSTACLE.lake, 48, 32, 16, 11),
      disc(TILE_FOR_OBSTACLE.ice, 28, 20, 3),
      disc(TILE_FOR_OBSTACLE.ice, 68, 20, 3),
      disc(TILE_FOR_OBSTACLE.ice, 28, 44, 3),
      disc(TILE_FOR_OBSTACLE.ice, 68, 44, 3),
      rect(TILE_FOR_OBSTACLE.grove, 4, 4, 6, 8),
      rect(TILE_FOR_OBSTACLE.grove, 84, 50, 6, 8),
    ],
    respawnMs: 35_000,
    slug: 'lago-congelado',
    species: ['gota', 'pedrino', 'brasa'],
    start: { x: 14, y: 52 },
    waypoints: [
      { x: 14, y: 52 },
      { x: 14, y: 20 },
      { x: 22, y: 12 },
      { x: 48, y: 10 },
      { x: 74, y: 12 },
      { x: 82, y: 22 },
      { x: 82, y: 44 },
      { x: 72, y: 54 },
      { x: 48, y: 56 },
      { x: 26, y: 56 },
    ],
  },
  {
    clusters: [
      { offsets: OFFSETS_QUAD, x: 28, y: 50 },
      // One row above the authored centre so the 2x2 keeps every spawn 10 tiles from the start.
      { offsets: OFFSETS_QUAD, x: 58, y: 47 },
      { offsets: OFFSETS_QUAD, x: 36, y: 22 },
      { offsets: OFFSETS_QUAD, x: 68, y: 22 },
      { offsets: OFFSETS_QUAD, x: 74, y: 44 },
    ],
    levelMax: 11,
    levelMin: 9,
    name: 'Bosque Urrante',
    obstacles: [
      rect(TILE_FOR_OBSTACLE.grove, 4, 4, 8, 10),
      rect(TILE_FOR_OBSTACLE.grove, 16, 4, 6, 6),
      rect(TILE_FOR_OBSTACLE.grove, 48, 4, 10, 6),
      rect(TILE_FOR_OBSTACLE.grove, 72, 4, 12, 8),
      rect(TILE_FOR_OBSTACLE.grove, 84, 16, 6, 8),
      rect(TILE_FOR_OBSTACLE.grove, 4, 34, 6, 8),
      rect(TILE_FOR_OBSTACLE.grove, 34, 34, 8, 8),
      rect(TILE_FOR_OBSTACLE.grove, 60, 44, 8, 6),
      rect(TILE_FOR_OBSTACLE.grove, 80, 52, 6, 6),
      rect(TILE_FOR_OBSTACLE.grove, 4, 52, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 44, 40, 4, 3),
      rect(TILE_FOR_OBSTACLE.ruins, 66, 8, 4, 3),
    ],
    respawnMs: 40_000,
    slug: 'bosque-urrante',
    species: ['broto', 'gota', 'pedrino', 'brasa'],
    start: { x: 50, y: 58 },
    waypoints: [
      { x: 50, y: 58 },
      { x: 20, y: 58 },
      { x: 14, y: 46 },
      { x: 24, y: 36 },
      { x: 14, y: 26 },
      { x: 20, y: 14 },
      { x: 38, y: 10 },
      { x: 52, y: 16 },
      { x: 46, y: 28 },
      { x: 60, y: 34 },
      { x: 78, y: 28 },
      { x: 84, y: 40 },
      { x: 74, y: 52 },
      { x: 60, y: 56 },
    ],
  },
  {
    clusters: [
      { offsets: OFFSETS_QUAD, x: 22, y: 22 },
      { offsets: OFFSETS_QUAD, x: 40, y: 22 },
      { offsets: OFFSETS_QUAD, x: 60, y: 20 },
      { offsets: OFFSETS_QUAD, x: 40, y: 52 },
      { offsets: OFFSETS_QUAD, x: 74, y: 30 },
      { offsets: OFFSETS_QUAD, x: 74, y: 46 },
    ],
    levelMax: 15,
    levelMin: 14,
    name: 'Ruínas de Pedra',
    obstacles: [
      rect(TILE_FOR_OBSTACLE.ruins, 4, 4, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 18, 4, 10, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 38, 4, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 56, 4, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 74, 4, 10, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 4, 20, 6, 10),
      rect(TILE_FOR_OBSTACLE.ruins, 22, 20, 6, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 74, 18, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 4, 38, 6, 10),
      rect(TILE_FOR_OBSTACLE.ruins, 22, 36, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 40, 36, 10, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 60, 36, 6, 8),
      rect(TILE_FOR_OBSTACLE.ruins, 4, 52, 6, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 62, 52, 8, 6),
      rect(TILE_FOR_OBSTACLE.ruins, 78, 54, 10, 6),
      disc(TILE_FOR_OBSTACLE.rubble, 44, 44, 3),
      disc(TILE_FOR_OBSTACLE.rubble, 66, 32, 3),
    ],
    respawnMs: 45_000,
    slug: 'ruinas-de-pedra',
    species: ['pedrino', 'cinzarra', 'gota', 'brasa'],
    start: { x: 14, y: 54 },
    waypoints: [
      { x: 14, y: 54 },
      { x: 14, y: 42 },
      { x: 28, y: 42 },
      { x: 28, y: 30 },
      { x: 14, y: 30 },
      { x: 14, y: 16 },
      { x: 34, y: 16 },
      { x: 34, y: 28 },
      { x: 48, y: 28 },
      { x: 48, y: 14 },
      { x: 66, y: 14 },
      { x: 66, y: 26 },
      { x: 54, y: 26 },
      { x: 54, y: 40 },
      { x: 68, y: 40 },
      { x: 68, y: 52 },
      { x: 52, y: 52 },
      { x: 52, y: 58 },
      { x: 34, y: 58 },
      { x: 34, y: 48 },
      { x: 22, y: 48 },
    ],
  },
];

function isInsideBorder(x: number, y: number): boolean {
  return x >= BORDER && y >= BORDER && x < WIDTH - BORDER && y < HEIGHT - BORDER;
}

function tileIndex(x: number, y: number): number {
  return y * WIDTH + x;
}

function setTile(tiles: TileId[], x: number, y: number, tile: TileId): void {
  if (!isInsideBorder(x, y)) {
    return;
  }
  tiles[tileIndex(x, y)] = tile;
}

function paintBorder(tiles: TileId[]): void {
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!isInsideBorder(x, y)) {
        tiles[tileIndex(x, y)] = TILE.TREE;
      }
    }
  }
}

function paintObstacle(tiles: TileId[], obstacle: Obstacle): void {
  if (obstacle.kind === 'rect') {
    for (let y = obstacle.y; y < obstacle.y + obstacle.height; y += 1) {
      for (let x = obstacle.x; x < obstacle.x + obstacle.width; x += 1) {
        setTile(tiles, x, y, obstacle.tile);
      }
    }
    return;
  }

  if (obstacle.kind === 'disc') {
    const radiusSquared = obstacle.radius ** 2;
    for (let y = obstacle.y - obstacle.radius; y <= obstacle.y + obstacle.radius; y += 1) {
      for (let x = obstacle.x - obstacle.radius; x <= obstacle.x + obstacle.radius; x += 1) {
        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        if (dx * dx + dy * dy <= radiusSquared) {
          setTile(tiles, x, y, obstacle.tile);
        }
      }
    }
    return;
  }

  const radiusXSquared = obstacle.radiusX ** 2;
  const radiusYSquared = obstacle.radiusY ** 2;
  for (let y = obstacle.y - obstacle.radiusY; y <= obstacle.y + obstacle.radiusY; y += 1) {
    for (let x = obstacle.x - obstacle.radiusX; x <= obstacle.x + obstacle.radiusX; x += 1) {
      const dx = x - obstacle.x;
      const dy = y - obstacle.y;
      if ((dx * dx) / radiusXSquared + (dy * dy) / radiusYSquared <= 1) {
        setTile(tiles, x, y, obstacle.tile);
      }
    }
  }
}

function bresenham(from: Tile, to: Tile): Tile[] {
  const points: Tile[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;

  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) {
      return points;
    }
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubled < dx) {
      error += dx;
      y += stepY;
    }
  }
}

function buildDenseLoop(waypoints: Tile[]): Tile[] {
  const loop: Tile[] = [];
  const lastWaypoint = waypoints.length - 1;

  for (let index = 0; index < waypoints.length; index += 1) {
    const from = waypoints[index];
    const to = waypoints[(index + 1) % waypoints.length];
    const segment = bresenham(from, to);
    const segmentStart = index === 0 ? 0 : 1;
    const segmentEnd = index === lastWaypoint ? segment.length - 1 : segment.length;

    for (let pointIndex = segmentStart; pointIndex < segmentEnd; pointIndex += 1) {
      const point = segment[pointIndex];
      const last = loop.at(-1);
      if (last && last.x === point.x && last.y === point.y) {
        continue;
      }
      loop.push(point);
    }
  }

  return loop;
}

function carveSquare(tiles: TileId[], center: Tile, radius: number, tile: TileId): void {
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      setTile(tiles, x, y, tile);
    }
  }
}

function carveStart(tiles: TileId[], start: Tile): void {
  carveSquare(tiles, start, START_CLEARING_RADIUS, TILE.PATH);

  for (let y = start.y - START_RING_RADIUS; y <= start.y + START_RING_RADIUS; y += 1) {
    for (let x = start.x - START_RING_RADIUS; x <= start.x + START_RING_RADIUS; x += 1) {
      const ringDistance = Math.max(Math.abs(x - start.x), Math.abs(y - start.y));
      if (ringDistance !== START_RING_RADIUS || !isInsideBorder(x, y)) {
        continue;
      }
      if (tiles[tileIndex(x, y)] !== TILE.GRASS) {
        continue;
      }
      tiles[tileIndex(x, y)] = (x + y) % 2 === 0 ? TILE.FLOWERS : TILE.TALL_GRASS;
    }
  }
}

function nearestLoopNode(center: Tile, loop: Tile[]): Tile {
  let best = loop[0] as Tile;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of loop) {
    const distance = Math.max(Math.abs(node.x - center.x), Math.abs(node.y - center.y));
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }

  return best;
}

function nearestLoopIndex(center: Tile, loop: Tile[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < loop.length; index += 1) {
    const node = loop[index] as Tile;
    const distance = Math.max(Math.abs(node.x - center.x), Math.abs(node.y - center.y));
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }

  return bestIndex;
}

function offsetPoint(cluster: Cluster, offset: Tile): Tile {
  return { x: cluster.x + offset.x, y: cluster.y + offset.y };
}

function readClusterPoints(cluster: Cluster): Tile[] {
  const points: Tile[] = [];
  for (const offset of cluster.offsets) {
    points.push(offsetPoint(cluster, offset));
  }
  return points;
}

function carveCluster(tiles: TileId[], cluster: Cluster, loop: Tile[]): void {
  for (const point of readClusterPoints(cluster)) {
    carveSquare(tiles, point, CLUSTER_RADIUS, TILE.PATH);
  }

  const target = nearestLoopNode(cluster, loop);
  for (const node of bresenham(cluster, target)) {
    setTile(tiles, node.x, node.y, TILE.PATH);
  }
}

function isNearAny(tile: Tile, nodes: Tile[]): boolean {
  for (const node of nodes) {
    if (Math.abs(tile.x - node.x) <= 1 && Math.abs(tile.y - node.y) <= 1) {
      return true;
    }
  }
  return false;
}

function hashSlug(slug: string): number {
  let hash = 2166136261;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  return next;
}

function createGrass(): TileId {
  return TILE.GRASS;
}

function decorate(
  tiles: TileId[],
  loop: Tile[],
  clusterPoints: Tile[],
  start: Tile,
  random: () => number,
): void {
  const protectedNodes = [...loop, ...clusterPoints, start];

  for (let y = BORDER; y < HEIGHT - BORDER; y += 1) {
    for (let x = BORDER; x < WIDTH - BORDER; x += 1) {
      const index = tileIndex(x, y);
      if (tiles[index] !== TILE.GRASS || isNearAny({ x, y }, protectedNodes)) {
        continue;
      }
      const roll = random();
      if (roll < FLOWER_RATE) {
        tiles[index] = TILE.FLOWERS;
      } else if (roll < FLOWER_RATE + TALL_GRASS_RATE) {
        tiles[index] = TILE.TALL_GRASS;
      }
    }
  }
}

type ClusterOrder = {
  index: number;
  loopIndex: number;
};

function compareClusterOrder(left: ClusterOrder, right: ClusterOrder): number {
  return left.loopIndex - right.loopIndex || left.index - right.index;
}

function buildSpawns(definition: AreaDefinition, loop: Tile[]): HuntMapSpawn[] {
  const order: ClusterOrder[] = [];
  for (const [index, cluster] of definition.clusters.entries()) {
    order.push({ index, loopIndex: nearestLoopIndex(cluster, loop) });
  }

  const ranked = order.toSorted(compareClusterOrder);
  const levelByCluster = new Map<number, number>();

  for (const [rank, entry] of ranked.entries()) {
    const ratio = ranked.length === 1 ? 0 : rank / (ranked.length - 1);
    const level =
      definition.levelMin + Math.round(ratio * (definition.levelMax - definition.levelMin));
    levelByCluster.set(entry.index, level);
  }

  const spawns: HuntMapSpawn[] = [];
  let spawnIndex = 0;

  for (const [clusterIndex, cluster] of definition.clusters.entries()) {
    const level = levelByCluster.get(clusterIndex) ?? definition.levelMin;
    for (const point of readClusterPoints(cluster)) {
      spawns.push({
        level,
        respawnMs: definition.respawnMs,
        species: definition.species[spawnIndex % definition.species.length] as string,
        x: point.x,
        y: point.y,
      });
      spawnIndex += 1;
    }
  }

  return spawns;
}

function buildSource(definition: AreaDefinition): HuntMapSource {
  const tiles: TileId[] = Array.from({ length: WIDTH * HEIGHT }, createGrass);
  paintBorder(tiles);
  for (const obstacle of definition.obstacles) {
    paintObstacle(tiles, obstacle);
  }

  const loop = buildDenseLoop(definition.waypoints);
  for (const node of loop) {
    carveSquare(tiles, node, CORRIDOR_RADIUS, TILE.PATH);
  }
  carveStart(tiles, definition.start);

  const clusterPoints: Tile[] = [];
  for (const cluster of definition.clusters) {
    carveCluster(tiles, cluster, loop);
    clusterPoints.push(...readClusterPoints(cluster));
  }

  decorate(tiles, loop, clusterPoints, definition.start, createRandom(hashSlug(definition.slug)));

  return {
    height: HEIGHT,
    loop,
    name: definition.name,
    slug: definition.slug,
    spawn: definition.start,
    spawns: buildSpawns(definition, loop),
    tiles,
    width: WIDTH,
  };
}

function isAdjacent(left: Tile, right: Tile): boolean {
  const dx = Math.abs(left.x - right.x);
  const dy = Math.abs(left.y - right.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}

function chebyshev(left: Tile, right: Tile): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function floodFrom(map: HuntMap, start: Tile): Uint8Array {
  const visited = new Uint8Array(map.width * map.height);
  const queue: Tile[] = [start];
  visited[tileIndex(start.x, start.y)] = 1;

  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head] as Tile;
    for (const offset of NEIGHBOURS) {
      const x = node.x + offset.x;
      const y = node.y + offset.y;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
        continue;
      }
      const index = tileIndex(x, y);
      if (visited[index] === 1 || !isWalkableTile(map, { x, y })) {
        continue;
      }
      visited[index] = 1;
      queue.push({ x, y });
    }
  }

  return visited;
}

function isLoopNode(tile: Tile, loop: Tile[]): boolean {
  for (const node of loop) {
    if (node.x === tile.x && node.y === tile.y) {
      return true;
    }
  }
  return false;
}

function validateLoop(map: HuntMap): void {
  if (map.tiles.length !== WIDTH * HEIGHT) {
    throw new Error(`${map.slug} has ${map.tiles.length} tiles, expected ${WIDTH * HEIGHT}`);
  }
  if (map.loop.length === 0) {
    throw new Error(`${map.slug} has an empty loop`);
  }

  for (let index = 0; index < map.loop.length; index += 1) {
    const node = map.loop[index] as Tile;
    const next = map.loop[(index + 1) % map.loop.length] as Tile;
    if (!isAdjacent(node, next)) {
      throw new Error(
        `${map.slug} has an open loop between ${node.x},${node.y} and ${next.x},${next.y}`,
      );
    }
    if (!isWalkableTile(map, node)) {
      throw new Error(`${map.slug} has a solid loop node at ${node.x},${node.y}`);
    }
  }

  if (!isLoopNode(map.spawn, map.loop)) {
    throw new Error(`${map.slug} start ${map.spawn.x},${map.spawn.y} is not on the loop`);
  }
  if (!isWalkableTile(map, map.spawn)) {
    throw new Error(`${map.slug} start ${map.spawn.x},${map.spawn.y} is solid`);
  }
}

function validateClusters(map: HuntMap, definition: AreaDefinition): void {
  for (let left = 0; left < definition.clusters.length; left += 1) {
    for (let right = left + 1; right < definition.clusters.length; right += 1) {
      const first = definition.clusters[left] as Cluster;
      const second = definition.clusters[right] as Cluster;
      if (chebyshev(first, second) < MIN_CLUSTER_DISTANCE) {
        throw new Error(
          `${map.slug} cluster centres ${first.x},${first.y} and ${second.x},${second.y} are too close`,
        );
      }
    }
  }
}

function validateSpawns(map: HuntMap): void {
  const reachable = floodFrom(map, map.spawn);
  for (const spawn of map.spawns) {
    const tile = { x: spawn.x, y: spawn.y };
    if (!isWalkableTile(map, tile)) {
      throw new Error(`${map.slug} has a solid spawn at ${spawn.x},${spawn.y}`);
    }
    if (chebyshev(map.spawn, tile) < MIN_SPAWN_DISTANCE) {
      throw new Error(
        `${map.slug} spawn ${spawn.x},${spawn.y} is within ${MIN_SPAWN_DISTANCE} of the start`,
      );
    }
    if (reachable[tileIndex(spawn.x, spawn.y)] !== 1) {
      throw new Error(`${map.slug} spawn ${spawn.x},${spawn.y} is unreachable from the start`);
    }
  }
}

function validateGeneratedMap(map: HuntMap, definition: AreaDefinition): void {
  validateLoop(map);
  validateClusters(map, definition);
  validateSpawns(map);
}

function indentRow(row: string): string {
  return `    ${row}`;
}

function writeMap(map: HuntMap): string {
  const rows: string[] = [];
  for (let y = 0; y < map.height; y += 1) {
    rows.push(JSON.stringify(map.tiles.slice(y * map.width, (y + 1) * map.width)));
  }
  const loop = map.loop.map(JSON.stringify).map(indentRow).join(',\n');
  const spawns = map.spawns.map(JSON.stringify).map(indentRow).join(',\n');
  return `{
  "slug": ${JSON.stringify(map.slug)},
  "name": ${JSON.stringify(map.name)},
  "width": ${map.width},
  "height": ${map.height},
  "spawn": { "x": ${map.spawn.x}, "y": ${map.spawn.y} },
  "tiles": [
${rows.map(indentRow).join(',\n')}
  ],
  "loop": [
${loop}
  ],
  "spawns": [
${spawns}
  ]
}
`;
}

for (const definition of AREAS) {
  const source = buildSource(definition);
  const map = readHuntMap(source, definition.slug);
  validateHuntMap(map);
  validateGeneratedMap(map, definition);
  const output = new URL(`${definition.slug}.json`, OUTPUT_DIR);
  await Bun.write(output, writeMap(map));
  globalThis.console.log(
    `wrote ${output.pathname} (${map.width}x${map.height}, loop ${map.loop.length}, spawns ${map.spawns.length})`,
  );
}
