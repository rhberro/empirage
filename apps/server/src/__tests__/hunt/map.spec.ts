/* eslint-disable max-lines -- the map validation scenarios share the fixtures */
import { expect, test } from 'bun:test';

import {
  HUNT_MAPS,
  MAX_HUNT_RESPAWN_MS,
  MIN_HUNT_RESPAWN_MS,
  huntMapBySlug,
  validateHuntMap,
} from '@creatures/contracts/huntMap';
import type { HuntMap, HuntMapSpawn } from '@creatures/contracts/huntMap';
import { TILE, isSolidTile, isWalkableTile } from '@creatures/contracts/world';
import type { Tile } from '@creatures/contracts/world';

const AREA_SLUGS: string[] = [
  'bosque-urrante',
  'campina-cinzenta',
  'lago-congelado',
  'ruinas-de-pedra',
];

const EXPECTED_SPECIES: Record<string, string[]> = {
  'bosque-urrante': ['broto', 'gota', 'pedrino', 'brasa'],
  'campina-cinzenta': ['brasa', 'broto', 'pedrino', 'cinzarra'],
  'lago-congelado': ['gota', 'pedrino', 'brasa'],
  'ruinas-de-pedra': ['pedrino', 'cinzarra', 'gota', 'brasa'],
};

/**
 * How many wild points each area carries.
 *
 * The count grows with the difficulty: an easy area has fewer clusters and
 * fewer creatures per cluster than the last one.
 */
const EXPECTED_SPAWN_COUNTS: Record<string, number> = {
  'bosque-urrante': 20,
  'campina-cinzenta': 12,
  'lago-congelado': 15,
  'ruinas-de-pedra': 24,
};

function cloneTile(tile: Tile): Tile {
  return { x: tile.x, y: tile.y };
}

function cloneSpawn(spawn: HuntMapSpawn): HuntMapSpawn {
  return {
    level: spawn.level,
    respawnMs: spawn.respawnMs,
    species: spawn.species,
    x: spawn.x,
    y: spawn.y,
  };
}

function cloneMap(map: HuntMap): HuntMap {
  return {
    height: map.height,
    loop: map.loop.map(cloneTile),
    name: map.name,
    slug: map.slug,
    spawn: cloneTile(map.spawn),
    spawns: map.spawns.map(cloneSpawn),
    tiles: [...map.tiles],
    width: map.width,
  };
}

function setTile(map: HuntMap, tile: Tile, tileId: number): void {
  map.tiles[tile.y * map.width + tile.x] = tileId as HuntMap['tiles'][number];
}

function isAdjacent(a: Tile, b: Tile): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}

function expectInvalid(map: HuntMap): void {
  let threw = false;
  try {
    validateHuntMap(map);
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
}

function chebyshev(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

/**
 * The spawns grouped by proximity: every point within one square of another
 * belongs to the same cluster.
 */
function groupSpawns(spawns: HuntMapSpawn[]): HuntMapSpawn[][] {
  const remaining = new Set<number>(
    spawns.map(function indexOf(_spawn, index): number {
      return index;
    }),
  );
  const clusters: HuntMapSpawn[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    remaining.delete(first);
    const seed = spawns[first];
    if (seed === undefined) {
      continue;
    }
    const cluster: HuntMapSpawn[] = [seed];
    const queue: HuntMapSpawn[] = [seed];
    while (queue.length > 0) {
      const current = queue.pop() as HuntMapSpawn;
      for (const index of remaining) {
        const candidate = spawns[index];
        if (candidate !== undefined && chebyshev(current, candidate) <= 1) {
          remaining.delete(index);
          cluster.push(candidate);
          queue.push(candidate);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function clusterDistance(left: HuntMapSpawn[], right: HuntMapSpawn[]): number {
  let distance = Number.POSITIVE_INFINITY;
  for (const first of left) {
    for (const second of right) {
      distance = Math.min(distance, chebyshev(first, second));
    }
  }
  return distance;
}

function isReachable(map: HuntMap, from: Tile, to: Tile): boolean {
  const queue: Tile[] = [from];
  const seen = new Set<string>([`${from.x},${from.y}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index] as Tile;
    if (current.x === to.x && current.y === to.y) {
      return true;
    }
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const next = { x: current.x + dx, y: current.y + dy };
        const key = `${next.x},${next.y}`;
        if (seen.has(key) || !isWalkableTile(map, next)) {
          continue;
        }
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return false;
}

test('loads the four areas as ninety-six by sixty-four maps', function loadsEveryArea(): void {
  expect(Object.keys(HUNT_MAPS)).toHaveLength(AREA_SLUGS.length);
  for (const slug of AREA_SLUGS) {
    const map = HUNT_MAPS[slug];
    validateHuntMap(map);
    expect(map.width).toBe(96);
    expect(map.height).toBe(64);
    expect(map.tiles).toHaveLength(map.width * map.height);
    expect(map.loop.length).toBeGreaterThan(0);
    expect(map.spawns).toHaveLength(EXPECTED_SPAWN_COUNTS[slug] ?? 0);
    expect(
      map.loop.some(function hasSpawn(node: Tile): boolean {
        return node.x === map.spawn.x && node.y === map.spawn.y;
      }),
    ).toBe(true);
    expect(huntMapBySlug(slug)).toBe(map);
  }
  expect(huntMapBySlug('missing')).toBeNull();
});

test('keeps every loop node walkable and the loop closed', function keepsLoopClosed(): void {
  for (const slug of AREA_SLUGS) {
    const map = HUNT_MAPS[slug];
    for (let index = 0; index < map.loop.length; index += 1) {
      const node = map.loop[index];
      const next = map.loop[(index + 1) % map.loop.length];
      expect(isWalkableTile(map, node)).toBe(true);
      expect(isAdjacent(node, next)).toBe(true);
    }
  }
});

test('keeps every spawn walkable and inside the expected species', function keepsSpawns(): void {
  for (const slug of AREA_SLUGS) {
    const map = HUNT_MAPS[slug];
    const species = EXPECTED_SPECIES[slug];
    for (const spawn of map.spawns) {
      expect(isWalkableTile(map, spawn)).toBe(true);
      expect(species).toContain(spawn.species);
      expect(spawn.level).toBeGreaterThanOrEqual(1);
      expect(spawn.respawnMs).toBeGreaterThanOrEqual(MIN_HUNT_RESPAWN_MS);
      expect(spawn.respawnMs).toBeLessThanOrEqual(MAX_HUNT_RESPAWN_MS);
    }
  }
});

test('keeps each spawn cluster together and the clusters apart', function keepsSpawnClusters(): void {
  for (const slug of AREA_SLUGS) {
    const map = HUNT_MAPS[slug];
    const clusters = groupSpawns(map.spawns);
    expect(clusters.length).toBeGreaterThanOrEqual(4);
    for (const cluster of clusters) {
      expect(cluster.length).toBeGreaterThanOrEqual(3);
      expect(cluster.length).toBeLessThanOrEqual(4);
    }
    for (let first = 0; first < clusters.length; first += 1) {
      for (let second = first + 1; second < clusters.length; second += 1) {
        expect(
          clusterDistance(clusters[first] ?? [], clusters[second] ?? []),
        ).toBeGreaterThanOrEqual(6);
      }
    }
    for (const spawn of map.spawns) {
      expect(chebyshev(spawn, map.spawn)).toBeGreaterThanOrEqual(10);
    }
  }
});

test('reaches every spawn from the start', function reachesEverySpawn(): void {
  for (const slug of AREA_SLUGS) {
    const map = HUNT_MAPS[slug];
    for (const spawn of map.spawns) {
      expect(isReachable(map, map.spawn, spawn)).toBe(true);
    }
  }
});

test('has obstacles inside the border', function hasInteriorObstacles(): void {
  for (const slug of AREA_SLUGS) {
    const map = HUNT_MAPS[slug];
    let solids = 0;
    for (let y = 2; y < map.height - 2; y += 1) {
      for (let x = 2; x < map.width - 2; x += 1) {
        if (isSolidTile(map.tiles[y * map.width + x] ?? TILE.GRASS)) {
          solids += 1;
        }
      }
    }
    expect(solids).toBeGreaterThan(20);
  }
});

test('rejects a solid loop node', function rejectsSolidLoop(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  setTile(map, map.loop[4], TILE.TREE);
  expectInvalid(map);
});

test('rejects a solid creature spawn', function rejectsSolidSpawn(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  setTile(map, map.spawn, TILE.WATER);
  expectInvalid(map);
});

test('rejects a solid wild spawn', function rejectsSolidWildSpawn(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  const spawn = map.spawns[0];
  setTile(map, spawn, TILE.TREE);
  expectInvalid(map);
});

test('rejects an open loop', function rejectsOpenLoop(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  map.loop = map.loop.slice(0, -1);
  expectInvalid(map);
});

test('rejects the wrong number of tiles', function rejectsWrongTileCount(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  map.tiles = map.tiles.slice(0, -1);
  expectInvalid(map);
});

test('rejects an invalid respawn', function rejectsInvalidRespawn(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  map.spawns[0].respawnMs = MIN_HUNT_RESPAWN_MS - 1;
  expectInvalid(map);
});

test('rejects an invalid level', function rejectsInvalidLevel(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  map.spawns[0].level = 0;
  expectInvalid(map);
});

test('rejects an empty species', function rejectsEmptySpecies(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  map.spawns[0].species = ' ';
  expectInvalid(map);
});

test('rejects an empty slug', function rejectsEmptySlug(): void {
  const map = cloneMap(HUNT_MAPS['campina-cinzenta']);
  map.slug = '';
  expectInvalid(map);
});
