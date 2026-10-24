import { Assets, Container, RenderTexture, Sprite } from 'pixi.js';
import type { Renderer, Spritesheet } from 'pixi.js';

import { TILE_SIZE_PX } from '~/entities/world/model/tiles';

/**
 * The grid of tiles the ground is painted from.
 *
 * Both the city and the hunt maps carry these fields, so the ground renderer
 * paints either without knowing which one it is.
 */
export type TileMap = {
  height: number;
  tiles: number[];
  width: number;
};

/**
 * The whole map, painted once into a single texture.
 */
export type GroundLayer = {
  destroy(): void;
  sprite: Sprite;
};

const TILES_URL = '/world/tiles.json';

/**
 * Draws every tile of the map into one render texture.
 *
 * The map is drawn once and never again: the tick only moves the camera over
 * this single sprite. Water and tall grass use their static first frame; their
 * animation arrives in a later phase. The texture is nearest-filtered and
 * integer-sized, so the pixel art stays sharp under the integer scale.
 */
export function createGroundLayer(renderer: Renderer, map: TileMap): Promise<GroundLayer> {
  return loadTilesSheet().then(function build(sheet: Spritesheet): GroundLayer {
    return renderGround(renderer, sheet, map);
  });
}

function loadTilesSheet(): Promise<Spritesheet> {
  return Assets.load<Spritesheet>({
    data: { textureOptions: { scaleMode: 'nearest' } },
    src: TILES_URL,
  });
}

function renderGround(renderer: Renderer, sheet: Spritesheet, map: TileMap): GroundLayer {
  const width = map.width * TILE_SIZE_PX;
  const height = map.height * TILE_SIZE_PX;
  const canvas = buildTileCanvas(sheet, map);
  const texture = RenderTexture.create({
    autoGenerateMipmaps: false,
    height,
    scaleMode: 'nearest',
    width,
  });
  renderer.render({ container: canvas, target: texture });
  canvas.destroy({ children: true });
  return {
    destroy: function destroy(): void {
      texture.destroy(true);
    },
    sprite: new Sprite(texture),
  };
}

/**
 * The tiles of the whole map, one sprite per square.
 */
function buildTileCanvas(sheet: Spritesheet, map: TileMap): Container {
  const canvas = new Container();
  for (let index = 0; index < map.tiles.length; index += 1) {
    canvas.addChild(buildTileSprite(sheet, map.tiles[index], index, map.width));
  }
  return canvas;
}

/**
 * One tile of the map, at its top-left pixel.
 */
function buildTileSprite(sheet: Spritesheet, id: number, index: number, columns: number): Sprite {
  const sprite = new Sprite(sheet.textures['tiles/' + id + ':0']);
  const x = (index % columns) * TILE_SIZE_PX;
  const y = Math.floor(index / columns) * TILE_SIZE_PX;
  sprite.position.set(x, y);
  return sprite;
}
