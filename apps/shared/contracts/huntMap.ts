import bosqueUrrante from './hunts/bosque-urrante.json';
import campinaCinzenta from './hunts/campina-cinzenta.json';
import lagoCongelado from './hunts/lago-congelado.json';
import ruinasDePedra from './hunts/ruinas-de-pedra.json';
import { isWalkableTile, type Tile, type TileId } from './world';

export const MIN_HUNT_RESPAWN_MS = 5_000;
export const MAX_HUNT_RESPAWN_MS = 3_600_000;

export type HuntMapSpawn = {
  level: number;
  respawnMs: number;
  species: string;
  x: number;
  y: number;
};

export type HuntMap = {
  height: number;
  loop: Tile[];
  name: string;
  slug: string;
  spawn: Tile;
  spawns: HuntMapSpawn[];
  tiles: TileId[];
  width: number;
};

/**
 * The committed shape of an area map.
 *
 * The rows are kept one line per map row so a layout change reads as a
 * vertical diff; the loader flattens them once, like the city map.
 */
export type HuntMapSource = {
  height: number;
  loop: Tile[];
  name: string;
  slug: string;
  spawn: Tile;
  spawns: HuntMapSpawn[];
  tiles: number[] | number[][];
  width: number;
};

function isAdjacent(a: Tile, b: Tile): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}

/**
 * Refuses a map the simulation could not run.
 *
 * The loop is dense, so two consecutive nodes being adjacent is enough to
 * guarantee the walk never crosses a solid square.
 */
export function validateHuntMap(map: HuntMap): void {
  if (map.slug.trim().length === 0) {
    throw new Error('hunt map has an empty slug');
  }
  if (map.tiles.length !== map.width * map.height) {
    throw new Error(`hunt map ${map.slug} has the wrong number of tiles`);
  }
  if (!isWalkableTile(map, map.spawn)) {
    throw new Error(`hunt map ${map.slug} has a solid spawn at ${map.spawn.x},${map.spawn.y}`);
  }
  if (map.loop.length === 0) {
    throw new Error(`hunt map ${map.slug} has an empty loop`);
  }

  for (let index = 0; index < map.loop.length; index += 1) {
    const node = map.loop[index];
    const next = map.loop[(index + 1) % map.loop.length];
    if (!isWalkableTile(map, node)) {
      throw new Error(`hunt map ${map.slug} has a solid loop node at ${node.x},${node.y}`);
    }
    if (!isAdjacent(node, next)) {
      throw new Error(
        `hunt map ${map.slug} has an open loop between ${node.x},${node.y} and ${next.x},${next.y}`,
      );
    }
  }

  for (const spawn of map.spawns) {
    const tile = { x: spawn.x, y: spawn.y };
    if (spawn.species.trim().length === 0) {
      throw new Error(`hunt map ${map.slug} has a spawn with an empty species`);
    }
    if (!Number.isInteger(spawn.level) || spawn.level < 1) {
      throw new Error(`hunt map ${map.slug} has a spawn with an invalid level`);
    }
    if (
      !Number.isInteger(spawn.respawnMs) ||
      spawn.respawnMs < MIN_HUNT_RESPAWN_MS ||
      spawn.respawnMs > MAX_HUNT_RESPAWN_MS
    ) {
      throw new Error(`hunt map ${map.slug} has a spawn with an invalid respawn`);
    }
    if (!isWalkableTile(map, tile)) {
      throw new Error(`hunt map ${map.slug} has a solid spawn at ${spawn.x},${spawn.y}`);
    }
  }
}

export function readHuntMap(source: HuntMapSource, slug: string): HuntMap {
  const rows = source.tiles;
  const tiles = Array.isArray(rows[0]) ? (rows as number[][]).flat() : (rows as number[]);
  const map: HuntMap = {
    height: source.height,
    loop: source.loop,
    name: source.name,
    slug,
    spawn: source.spawn,
    spawns: source.spawns,
    tiles: tiles as TileId[],
    width: source.width,
  };
  validateHuntMap(map);
  return map;
}

/**
 * The area maps the whole game shares.
 *
 * Both the server and the client read the same committed bytes: a map change
 * is one diff, never a payload over the socket.
 */
export const HUNT_MAPS: Record<string, HuntMap> = {
  'bosque-urrante': readHuntMap(bosqueUrrante, 'bosque-urrante'),
  'campina-cinzenta': readHuntMap(campinaCinzenta, 'campina-cinzenta'),
  'lago-congelado': readHuntMap(lagoCongelado, 'lago-congelado'),
  'ruinas-de-pedra': readHuntMap(ruinasDePedra, 'ruinas-de-pedra'),
};

export function huntMapBySlug(slug: string): HuntMap | null {
  return HUNT_MAPS[slug] ?? null;
}
