/* eslint-disable unicorn/no-array-fill-with-reference-type -- Pixi `Graphics.fill` is not `Array.fill` */
import type { HuntMap } from '@creatures/contracts/huntMap';
import { Container, Sprite, Texture } from 'pixi.js';
import type { Renderer } from 'pixi.js';

import { readAreaTone } from '~/entities/hunt/model/areaTone';
import { TILE_SIZE_PX } from '~/entities/world/model/tiles';
import { createGroundLayer, type GroundLayer } from '~/entities/world/ui/layers/groundRenderer';

export type HuntGroundLayer = {
  container: Container;
  destroy(): void;
};

/**
 * The ground of the hunt area, with the subtle tone of the place on top.
 *
 * The tiles reuse the city ground; the tint is a wash that ties the area to
 * its element without hiding the tiles.
 */
export function createHuntGroundLayer(renderer: Renderer, map: HuntMap): Promise<HuntGroundLayer> {
  return createGroundLayer(renderer, map).then(function build(
    ground: GroundLayer,
  ): HuntGroundLayer {
    const container = new Container();
    container.addChild(ground.sprite);
    container.addChild(buildTint(map));
    return {
      container,
      destroy: ground.destroy,
    };
  });
}

function buildTint(map: HuntMap): Sprite {
  const tone = readAreaTone(map.slug);
  const tint = new Sprite(Texture.WHITE);
  tint.width = map.width * TILE_SIZE_PX;
  tint.height = map.height * TILE_SIZE_PX;
  tint.tint = tone.color;
  tint.alpha = tone.alpha;
  return tint;
}
