/* eslint-disable max-lines */
import type {
  HuntCreatureActor,
  HuntRuntimeEvent,
  HuntTrainerActor,
} from '@creatures/contracts/huntSim';
import type { PathSegment, Tile } from '@creatures/contracts/world';
import { AnimatedSprite, Assets, Container, Sprite, Texture } from 'pixi.js';
import type { Spritesheet } from 'pixi.js';

import { computeCreatureAnimation } from '~/entities/hunt/model/creatureAnimation';
import {
  CAPTURE_FLY_MS,
  computeCaptureVisual,
  computeSwapVisual,
  isSwapFinished,
  LEVEL_UP_FLASH_MS,
} from '~/entities/hunt/model/huntAnimation';
import {
  buildEventIndex,
  DAMAGE_FLASH_MS,
  type HuntEventIndex,
} from '~/entities/hunt/model/huntEvents';
import { computeActorAnimation } from '~/entities/world/model/actorState';
import { computeActorPosition } from '~/entities/world/model/steps';
import { TILE_SIZE_PX } from '~/entities/world/model/tiles';

import { createCanvasTexture } from './canvasTexture';

export type CreatureLayerInput = {
  events: HuntRuntimeEvent[];
  player: HuntCreatureActor;
  trainer: HuntTrainerActor;
  wilds: HuntCreatureActor[];
};

export type CreatureLayer = {
  container: Container;
  update(input: CreatureLayerInput, now: number): void;
};

const CREATURES_URL = '/world/creatures.json';
const TRAINER_URL = '/world/trainer.json';

const FEET_OFFSET_X = TILE_SIZE_PX / 2;
const FEET_OFFSET_Y = TILE_SIZE_PX;
const FLASH_TINT = 0xff6b6b;
const LEVEL_UP_TINT = 0xffd166;
const CORPSE_TINT = 0x8b9299;

const TRAINER_STATE_KEY: Record<'idle' | 'walking', string> = {
  idle: 'idle',
  walking: 'walk',
};

type UnitKind = 'creature' | 'trainer';

type UnitTransform = {
  alpha: number;
  scale: number;
};

type Unit = {
  animationKey: string;
  container: Container;
  flashUntil: number;
  kind: UnitKind;
  ring: Sprite;
  shadow: Sprite;
  slug: string;
  sprite: AnimatedSprite;
};

type SwapAnimation = {
  at: number;
  outgoing: HuntCreatureActor;
};

type CreatureLayerContext = {
  active: HuntCreatureActor | null;
  ball: Sprite;
  container: Container;
  creaturesSheet: Spritesheet;
  rings: Container;
  shadows: Container;
  sprites: Map<string, Unit>;
  swap: SwapAnimation | null;
  trainerSheet: Spritesheet;
  units: Container;
};

let ballTexture: Texture | null = null;
let ringTexture: Texture | null = null;
let shadowTexture: Texture | null = null;

/**
 * The creatures and the trainer of the hunt. Shadows, rings and unit sprites
 * live in separate containers so each texture batches into one draw call.
 */
export function createCreatureLayer(): Promise<CreatureLayer> {
  return Promise.all([loadCreaturesSheet(), loadTrainerSheet()]).then(function build(
    sheets: [Spritesheet, Spritesheet],
  ): CreatureLayer {
    const [creaturesSheet, trainerSheet] = sheets;
    const container = new Container();
    const shadows = new Container();
    const rings = new Container();
    const units = new Container();
    units.sortableChildren = true;
    const ball = new Sprite(readBallTexture());
    ball.anchor.set(0.5, 0.5);
    ball.visible = false;
    container.addChild(shadows, rings, units, ball);
    const context: CreatureLayerContext = {
      active: null,
      ball,
      container,
      creaturesSheet,
      rings,
      shadows,
      sprites: new Map<string, Unit>(),
      swap: null,
      trainerSheet,
      units,
    };
    return {
      container,
      update: function update(input: CreatureLayerInput, now: number): void {
        updateCreatures(context, input, now);
      },
    };
  });
}

function loadCreaturesSheet(): Promise<Spritesheet> {
  return Assets.load<Spritesheet>({
    data: { textureOptions: { scaleMode: 'nearest' } },
    src: CREATURES_URL,
  });
}

function loadTrainerSheet(): Promise<Spritesheet> {
  return Assets.load<Spritesheet>({
    data: { textureOptions: { scaleMode: 'nearest' } },
    src: TRAINER_URL,
  });
}

function updateCreatures(
  context: CreatureLayerContext,
  input: CreatureLayerInput,
  now: number,
): void {
  const present = new Set<string>();
  const targetId = input.player.targetId ?? null;
  const index = buildEventIndex(input.events);
  for (const wild of input.wilds) {
    placeCreature(context, wild, index, targetId, now, present, null);
  }
  trackActive(context, input.player, now);
  if (context.swap !== null && isSwapFinished(now - context.swap.at)) {
    context.swap = null;
  }
  if (context.swap === null) {
    placeCreature(context, input.player, index, targetId, now, present, null);
    context.ball.visible = false;
  } else {
    placeSwap(context, context.swap, input.player, index, targetId, now, present);
  }
  placeTrainer(context, input.trainer, now, present);
  removeGone(context, present);
}

/**
 * Tracks the creature in the field: when the server swaps it, the previous one
 * is the one that returns into the ball.
 */
function trackActive(context: CreatureLayerContext, player: HuntCreatureActor, now: number): void {
  const previous = context.active;
  context.active = player;
  if (previous !== null && previous.id !== player.id) {
    context.swap = { at: now, outgoing: previous };
  }
}

function placeSwap(
  context: CreatureLayerContext,
  swap: SwapAnimation,
  incoming: HuntCreatureActor,
  index: HuntEventIndex,
  targetId: string | null,
  now: number,
  present: Set<string>,
): void {
  const visual = computeSwapVisual(now - swap.at);
  const outgoingTransform: UnitTransform = {
    alpha: visual.outgoingAlpha,
    scale: visual.outgoingScale,
  };
  const incomingTransform: UnitTransform = {
    alpha: visual.incomingAlpha,
    scale: visual.incomingScale,
  };
  placeCreature(context, swap.outgoing, index, targetId, now, present, outgoingTransform);
  placeCreature(context, incoming, index, targetId, now, present, incomingTransform);
  placeBall(context, visual, swap.outgoing, incoming, now);
}

function placeCreature(
  context: CreatureLayerContext,
  actor: HuntCreatureActor,
  index: HuntEventIndex,
  targetId: string | null,
  now: number,
  present: Set<string>,
  transform: UnitTransform | null,
): void {
  const dead = isWildDead(actor, index);
  const cast = dead ? null : (index.casts.get(actor.id) ?? null);
  const segment = dead ? undefined : actor.segment;
  const animation = dead
    ? { frame: 0, pose: 'down' as const, state: 'idle' as const }
    : computeCreatureAnimation({
        castAt: cast === null ? null : cast.at,
        dir: actor.dir,
        now,
        segment,
      });
  const key = `creature/${actor.speciesSlug}/${animation.pose}/${animation.state}`;
  const unit = ensureUnit(context, actor.id, 'creature', actor.speciesSlug, key);
  const capture = readCaptureTransform(actor, index, now);
  unit.ring.visible = !dead && actor.id === targetId;
  placeUnit(unit, actor.tile, segment, now, animation.frame, capture ?? transform);
  if (dead) {
    applyCorpse(unit);
  } else {
    applyFlash(unit, index.damagedAt.get(actor.id) ?? null, now);
    applyLevelUp(unit, index.levelUps.get(actor.id) ?? null, now);
  }
  present.add(actor.id);
}

function placeTrainer(
  context: CreatureLayerContext,
  trainer: HuntTrainerActor,
  now: number,
  present: Set<string>,
): void {
  const id = 'trainer';
  const segment = trainer.segment;
  const animation = computeActorAnimation(trainer.dir, segment, now);
  const key = `trainer/${animation.pose}/${TRAINER_STATE_KEY[animation.state]}`;
  const unit = ensureUnit(context, id, 'trainer', 'trainer', key);
  placeUnit(unit, trainer.tile, segment, now, animation.frame, null);
  present.add(id);
}

function placeUnit(
  unit: Unit,
  tile: Tile,
  segment: PathSegment | undefined,
  now: number,
  frame: number,
  transform: UnitTransform | null,
): void {
  const pixel = computeActorPosition(segment === undefined ? [] : [segment], now, tile);
  const x = pixel.x + FEET_OFFSET_X;
  const y = pixel.y + FEET_OFFSET_Y;
  unit.container.position.set(x, y);
  unit.container.zIndex = y;
  unit.container.alpha = transform === null ? 1 : transform.alpha;
  unit.container.scale.set(transform === null ? 1 : transform.scale);
  unit.sprite.position.set(0, 0);
  unit.sprite.rotation = 0;
  unit.sprite.gotoAndStop(frame);
  unit.shadow.alpha = 1;
  unit.shadow.position.set(x, y - 1);
  unit.ring.position.set(x, y - 1);
}

function applyCorpse(unit: Unit): void {
  unit.sprite.tint = CORPSE_TINT;
  unit.sprite.rotation = Math.PI / 2;
  unit.sprite.position.set(-TILE_SIZE_PX / 4, -2);
  unit.shadow.alpha = 0.5;
}

function ensureUnit(
  context: CreatureLayerContext,
  id: string,
  kind: UnitKind,
  slug: string,
  animationKey: string,
): Unit {
  const existing = context.sprites.get(id);
  if (existing !== undefined) {
    if (existing.slug === slug && existing.kind === kind) {
      applyAnimation(existing, context, animationKey);
      return existing;
    }
    removeUnit(context, id);
  }
  const sheet = kind === 'creature' ? context.creaturesSheet : context.trainerSheet;
  const sprite = new AnimatedSprite({
    autoUpdate: false,
    textures: sheet.animations[animationKey] ?? [],
  });
  sprite.anchor.set(0.5, 1);
  const shadow = new Sprite(readShadowTexture());
  shadow.anchor.set(0.5, 0.5);
  shadow.zIndex = 0;
  shadow.cullable = true;
  const ring = new Sprite(readRingTexture());
  ring.anchor.set(0.5, 0.5);
  ring.visible = false;
  ring.cullable = true;
  const container = new Container();
  container.cullable = true;
  container.addChild(sprite);
  context.shadows.addChild(shadow);
  context.rings.addChild(ring);
  context.units.addChild(container);
  const unit: Unit = {
    animationKey,
    container,
    flashUntil: 0,
    kind,
    ring,
    shadow,
    slug,
    sprite,
  };
  context.sprites.set(id, unit);
  return unit;
}

function applyAnimation(unit: Unit, context: CreatureLayerContext, animationKey: string): void {
  if (unit.animationKey === animationKey) {
    return;
  }
  const sheet = unit.kind === 'creature' ? context.creaturesSheet : context.trainerSheet;
  unit.animationKey = animationKey;
  unit.sprite.textures = sheet.animations[animationKey] ?? [];
  unit.sprite.gotoAndStop(0);
}

function applyFlash(unit: Unit, hitAt: number | null, now: number): void {
  if (hitAt !== null && now - hitAt < DAMAGE_FLASH_MS) {
    unit.flashUntil = hitAt + DAMAGE_FLASH_MS;
  }
  unit.sprite.tint = now < unit.flashUntil ? FLASH_TINT : 0xffffff;
}

function applyLevelUp(unit: Unit, levelAt: number | null, now: number): void {
  if (levelAt === null) {
    return;
  }
  if (now >= levelAt && now - levelAt < LEVEL_UP_FLASH_MS) {
    unit.flashUntil = levelAt + LEVEL_UP_FLASH_MS;
    unit.sprite.tint = LEVEL_UP_TINT;
  }
}

function isWildDead(actor: HuntCreatureActor, index: HuntEventIndex): boolean {
  return actor.kind === 'wild' && (actor.hp <= 0 || index.deaths.has(actor.id));
}

function readCaptureTransform(
  actor: HuntCreatureActor,
  index: HuntEventIndex,
  now: number,
): UnitTransform | null {
  if (actor.kind !== 'wild') {
    return null;
  }
  const capture = index.captures.get(actor.id);
  if (capture === undefined || !capture.success) {
    return null;
  }
  const elapsed = now - capture.at;
  if (elapsed < CAPTURE_FLY_MS) {
    return null;
  }
  const visual = computeCaptureVisual(elapsed, true);
  return { alpha: visual.targetAlpha, scale: visual.targetScale };
}

function placeBall(
  context: CreatureLayerContext,
  visual: ReturnType<typeof computeSwapVisual>,
  outgoing: HuntCreatureActor,
  incoming: HuntCreatureActor,
  now: number,
): void {
  const source = visual.ballAtIncoming ? incoming : outgoing;
  const pixel = computeActorPosition(
    source.segment === undefined ? [] : [source.segment],
    now,
    source.tile,
  );
  context.ball.visible = true;
  context.ball.position.set(pixel.x + TILE_SIZE_PX / 2, pixel.y + TILE_SIZE_PX / 2 - 4);
  context.ball.scale.set(visual.ballScale);
  context.ball.alpha = visual.ballAlpha;
}

function readShadowTexture(): Texture {
  if (shadowTexture === null) {
    shadowTexture = createCanvasTexture(14, 6, function draw(context): void {
      context.fillStyle = 'rgba(0, 0, 0, 0.22)';
      context.beginPath();
      context.ellipse(7, 3, 7, 3, 0, 0, Math.PI * 2);
      context.fill();
    });
  }
  return shadowTexture;
}

function readRingTexture(): Texture {
  if (ringTexture === null) {
    ringTexture = createCanvasTexture(16, 8, function draw(context): void {
      context.strokeStyle = 'rgba(242, 165, 58, 0.9)';
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(8, 4, 8, 4, 0, 0, Math.PI * 2);
      context.stroke();
    });
  }
  return ringTexture;
}

function readBallTexture(): Texture {
  if (ballTexture === null) {
    ballTexture = createCanvasTexture(12, 12, function draw(context): void {
      context.fillStyle = '#e04b52';
      context.beginPath();
      context.arc(6, 6, 5, Math.PI, 0);
      context.closePath();
      context.fill();
      context.fillStyle = '#f0f3f6';
      context.beginPath();
      context.arc(6, 6, 5, 0, Math.PI);
      context.closePath();
      context.fill();
      context.fillStyle = '#0a0e12';
      context.fillRect(1, 5.5, 10, 1);
      context.beginPath();
      context.arc(6, 6, 1.6, 0, Math.PI * 2);
      context.fill();
    });
  }
  return ballTexture;
}

function removeGone(context: CreatureLayerContext, present: Set<string>): void {
  for (const id of context.sprites.keys()) {
    if (!present.has(id)) {
      removeUnit(context, id);
    }
  }
}

function removeUnit(context: CreatureLayerContext, id: string): void {
  const unit = context.sprites.get(id);
  if (unit === undefined) {
    return;
  }
  unit.container.destroy({ children: true });
  unit.shadow.destroy();
  unit.ring.destroy();
  context.sprites.delete(id);
}
