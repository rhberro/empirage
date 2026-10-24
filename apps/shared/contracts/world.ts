import type { Gender } from './trainer';

/**
 * The eight directions an actor can face and walk in.
 *
 * The grid allows the diagonals, and the sprite has only four of these
 * directions drawn: the left column is the mirror of the right one.
 */
export type Direction =
  | 'up'
  | 'upRight'
  | 'right'
  | 'downRight'
  | 'down'
  | 'downLeft'
  | 'left'
  | 'upLeft';

/**
 * A square of the world grid.
 *
 * Positions are tiles, they are integers by rule, and they name the square an
 * actor stands on — the pixel identity of a sprite is derived from the tile,
 * never the other way around.
 */
export type Tile = {
  x: number;
  y: number;
};

/**
 * One step of a walk, with the absolute times of the server clock.
 *
 * The client derives the position from its own corrected server clock instead
 * of counting elapsed durations, so a hidden tab, lag or a reconnect lands on
 * the right spot without accumulating drift. Durations are implied by the
 * pair, and the diagonal takes longer than the orthogonal by construction.
 */
export type PathSegment = {
  from: Tile;
  to: Tile;
  dir: Direction;
  startsAt: number;
  endsAt: number;
};

/**
 * What one actor in the world looks like to the client.
 *
 * `position` is the confirmed tile, and `segment` is the step in course, when
 * there is one — the client interpolates between them while both hold. There
 * is no path history here: an actor carries at most the step it is on.
 */
export type ActorMedia = {
  actorId: string;
  name: string;
  gender: Gender;
  dir: Direction;
  position: Tile;
  segment?: PathSegment;
};

/**
 * The ids of the tiles the shared city map is built from.
 *
 * The id is the one piece both the map on the server and the atlas of the
 * client agree on: the renderer paints by it and the pathfinding blocks by
 * it. The ids are numbers so the committed map stays a row of short rows.
 */
export const TILE = {
  DOOR: 7,
  FENCE: 5,
  FLOWERS: 2,
  GRASS: 0,
  PATH: 1,
  TALL_GRASS: 3,
  TREE: 8,
  WALL: 6,
  WATER: 4,
  WELL: 9,
} as const;

export type TileId = (typeof TILE)[keyof typeof TILE];

export type TileMeta = {
  /** Blocks movement. The server pathfinding refuses to enter. */
  solid?: boolean;
  /** How many animation frames the tile has, when it animates. */
  frames?: number;
};

/**
 * How long an orthogonal step takes, in milliseconds.
 *
 * The step is the unit of the walk: the server plans it, the client predicts it
 * and both must use the same duration, or the predicted step would end before
 * or after the server's.
 */
export const ORTHOGONAL_STEP_MS = 300;

/**
 * How long a diagonal step takes, in milliseconds.
 *
 * The diagonal covers more distance on screen, so it takes longer than the
 * orthogonal by the square root of two, rounded to the whole millisecond.
 */
export const DIAGONAL_STEP_MS = 424;

/**
 * The duration of one step between two adjacent tiles.
 */
export function stepDurationMs(from: Tile, to: Tile): number {
  if (from.x === to.x && from.y === to.y) {
    return 0;
  }
  return from.x !== to.x && from.y !== to.y ? DIAGONAL_STEP_MS : ORTHOGONAL_STEP_MS;
}

/**
 * The one place tile ids are described.
 *
 * The server reads `solid`, the client reads `frames`, and neither ever
 * hardcodes a property an id is known to have.
 */
export const TILE_META: Record<TileId, TileMeta> = {
  [TILE.GRASS]: {},
  [TILE.PATH]: {},
  [TILE.FLOWERS]: {},
  [TILE.TALL_GRASS]: { frames: 2 },
  [TILE.WATER]: { frames: 2, solid: true },
  [TILE.FENCE]: { solid: true },
  [TILE.WALL]: { solid: true },
  [TILE.DOOR]: {},
  [TILE.TREE]: { solid: true },
  [TILE.WELL]: { solid: true },
};

/**
 * The shape of the committed city map.
 *
 * The map is a single file committed to the repository: the server imports it
 * to judge collisions and paths, and the client imports it to paint. It never
 * travels over the socket; both sides holding the same bytes is the whole
 * point of the single source.
 */
export type CityMap = {
  name: string;
  width: number;
  height: number;
  spawn: Tile;
  /** Row-major: the tile of a square is `tiles[y * width + x]`. */
  tiles: TileId[];
};

/**
 * The tile of a square, with the world outside the map solid by definition.
 *
 * The wall outside is what keeps a path from ever leaving the map: the
 * pathfinding asks for the tile of any neighbor without a bounds check.
 */
export function tileAt(map: CityMap, x: number, y: number): TileId {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return TILE.TREE;
  }
  return map.tiles[y * map.width + x];
}

export function isSolidTile(tileId: number): boolean {
  return TILE_META[tileId as TileId]?.solid === true;
}

/**
 * Whether an actor can stand on a square of the map.
 *
 * The spawn is validated by the same rule, so a map that ships with a spawn
 * inside a wall is caught by whoever builds it, not by a player.
 */
export function isWalkableTile(map: CityMap, tile: Tile): boolean {
  return !isSolidTile(tileAt(map, tile.x, tile.y));
}
