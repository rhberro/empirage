import type { HuntCreatureActor } from '@creatures/contracts/huntSim';
import { Container, Sprite, Texture } from 'pixi.js';

import { computeActorPosition } from '~/entities/world/model/steps';
import { TILE_SIZE_PX } from '~/entities/world/model/tiles';

import { createCanvasTexture } from './canvasTexture';

export type HealthLayerInput = {
  player: HuntCreatureActor;
  wilds: HuntCreatureActor[];
};

export type HealthLayer = {
  container: Container;
  update(input: HealthLayerInput, now: number): void;
};

const BAR_WIDTH = 18;
const BAR_HEIGHT = 3;
const BAR_ABOVE_FEET = 22;

const BAR_BACKGROUND = 0x0a0e12;
const BAR_BORDER = '#1c242c';
const ACTIVE_FILL = 0x54d184;
const WILD_FILL = 0xe04b52;

type Bar = {
  background: Sprite;
  border: Sprite;
  fill: Sprite;
  isActive: boolean;
};

type HealthLayerContext = {
  bars: Map<string, Bar>;
  borders: Container;
  container: Container;
  fills: Container;
};

let borderTexture: Texture | null = null;

/**
 * The health bars of every creature, floating above their heads.
 *
 * The sprites are split by texture: every background and fill shares the white
 * texture, every border shares the border texture. The renderer then batches
 * all bars into two draw calls instead of alternating textures per bar.
 */
export function createHealthLayer(): HealthLayer {
  const container = new Container();
  const fills = new Container();
  const borders = new Container();
  container.addChild(fills, borders);
  const context: HealthLayerContext = {
    bars: new Map<string, Bar>(),
    borders,
    container,
    fills,
  };
  return {
    container,
    update: function update(input: HealthLayerInput, now: number): void {
      updateBars(context, input, now);
    },
  };
}

function updateBars(context: HealthLayerContext, input: HealthLayerInput, now: number): void {
  const present = new Set<string>();
  for (const wild of input.wilds) {
    placeBar(context, wild, false, now, present);
  }
  placeBar(context, input.player, true, now, present);
  removeGone(context, present);
}

function placeBar(
  context: HealthLayerContext,
  actor: HuntCreatureActor,
  isActive: boolean,
  now: number,
  present: Set<string>,
): void {
  const bar = ensureBar(context, actor.id, isActive);
  const alive = actor.hp > 0;
  bar.background.visible = alive;
  bar.border.visible = alive;
  bar.fill.visible = alive;
  if (!alive) {
    present.add(actor.id);
    return;
  }
  const pixel = computeActorPosition(
    actor.segment === undefined ? [] : [actor.segment],
    now,
    actor.tile,
  );
  const left = pixel.x + TILE_SIZE_PX / 2 - BAR_WIDTH / 2;
  const top = pixel.y + TILE_SIZE_PX - BAR_ABOVE_FEET;
  bar.background.position.set(left, top);
  bar.fill.position.set(left, top);
  bar.border.position.set(left, top);
  bar.fill.width = BAR_WIDTH * readRatio(actor);
  if (bar.isActive !== isActive) {
    bar.isActive = isActive;
    bar.fill.tint = isActive ? ACTIVE_FILL : WILD_FILL;
  }
  present.add(actor.id);
}

function ensureBar(context: HealthLayerContext, id: string, isActive: boolean): Bar {
  const existing = context.bars.get(id);
  if (existing !== undefined) {
    return existing;
  }
  const background = createBarSprite(BAR_BACKGROUND);
  const fill = createBarSprite(isActive ? ACTIVE_FILL : WILD_FILL);
  const border = new Sprite(readBorderTexture());
  border.width = BAR_WIDTH;
  border.height = BAR_HEIGHT;
  background.cullable = true;
  fill.cullable = true;
  border.cullable = true;
  context.fills.addChild(background, fill);
  context.borders.addChild(border);
  const created: Bar = { background, border, fill, isActive };
  context.bars.set(id, created);
  return created;
}

function createBarSprite(color: number): Sprite {
  const sprite = new Sprite(Texture.WHITE);
  sprite.width = BAR_WIDTH;
  sprite.height = BAR_HEIGHT;
  sprite.tint = color;
  return sprite;
}

function readBorderTexture(): Texture {
  if (borderTexture === null) {
    borderTexture = createCanvasTexture(BAR_WIDTH, BAR_HEIGHT, function draw(context): void {
      context.clearRect(0, 0, BAR_WIDTH, BAR_HEIGHT);
      context.strokeStyle = BAR_BORDER;
      context.lineWidth = 1;
      context.strokeRect(0.5, 0.5, BAR_WIDTH - 1, BAR_HEIGHT - 1);
    });
  }
  return borderTexture;
}

function readRatio(actor: HuntCreatureActor): number {
  if (actor.maxHp <= 0) {
    return 0;
  }
  const ratio = actor.hp / actor.maxHp;
  if (ratio < 0) {
    return 0;
  }
  if (ratio > 1) {
    return 1;
  }
  return ratio;
}

function removeGone(context: HealthLayerContext, present: Set<string>): void {
  for (const id of context.bars.keys()) {
    if (!present.has(id)) {
      removeBar(context, id);
    }
  }
}

function removeBar(context: HealthLayerContext, id: string): void {
  const bar = context.bars.get(id);
  if (bar === undefined) {
    return;
  }
  bar.background.destroy();
  bar.fill.destroy();
  bar.border.destroy();
  context.bars.delete(id);
}
