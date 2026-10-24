import type { ActorMedia, Direction, PathSegment, Tile } from '@creatures/contracts/world';
import { AnimatedSprite, Assets, Container } from 'pixi.js';
import type { Spritesheet } from 'pixi.js';

import { computeActorAnimation } from '~/entities/world/model/actorState';
import type { ActorState, TrainerPose } from '~/entities/world/model/actorState';
import { computeActorPosition, resolveSegment } from '~/entities/world/model/steps';
import { TILE_SIZE_PX } from '~/entities/world/model/tiles';

/**
 * The actors the layer draws this frame.
 */
export type ActorsInput = {
  actors: Record<string, ActorMedia>;
  path: PathSegment[];
  you: ActorMedia | null;
};

/**
 * The sprites of every visible actor, reconciled by id.
 */
export type ActorsLayer = {
  container: Container;
  update(input: ActorsInput, now: number, renderNow: number): void;
};

const TRAINER_URL = '/world/trainer.json';

/**
 * The feet of the sprite sit at the bottom-center of the square the actor
 * stands on.
 */
const FEET_OFFSET_X = TILE_SIZE_PX / 2;
const FEET_OFFSET_Y = TILE_SIZE_PX;

const FRAME_KEY_BY_STATE: Record<ActorState, string> = {
  idle: 'idle',
  walking: 'walk',
};

type ActorSpriteState = {
  pose: TrainerPose;
  sprite: AnimatedSprite;
  state: ActorState;
};

type ActorLayerContext = {
  container: Container;
  sheet: Spritesheet;
  sprites: Map<string, ActorSpriteState>;
};

/**
 * Builds the actor layer from the trainer atlas.
 */
export function createActorsLayer(): Promise<ActorsLayer> {
  return loadTrainerSheet().then(buildActorLayer);
}

function loadTrainerSheet(): Promise<Spritesheet> {
  return Assets.load<Spritesheet>({
    data: { textureOptions: { scaleMode: 'nearest' } },
    src: TRAINER_URL,
  });
}

function buildActorLayer(sheet: Spritesheet): ActorsLayer {
  const container = new Container();
  const sprites = new Map<string, ActorSpriteState>();
  const context = { container, sheet, sprites };
  return {
    container,
    update: function update(input: ActorsInput, now: number, renderNow: number): void {
      updateActors(context, input, now, renderNow);
    },
  };
}

function updateActors(
  context: ActorLayerContext,
  input: ActorsInput,
  now: number,
  renderNow: number,
): void {
  const present = new Set<string>();
  if (input.you !== null) {
    present.add(input.you.actorId);
    // The player is the one actor whose position the client predicts: it is
    // drawn at the estimated server time, not behind the playback buffer.
    placeActor(context, input.you.actorId, input.you.dir, input.path, input.you.position, now);
  }
  for (const actor of Object.values(input.actors)) {
    if (input.you !== null && actor.actorId === input.you.actorId) {
      continue;
    }
    present.add(actor.actorId);
    const path = actor.segment === undefined ? [] : [actor.segment];
    placeActor(context, actor.actorId, actor.dir, path, actor.position, renderNow);
  }
  removeGoneActors(context, present);
}

function placeActor(
  context: ActorLayerContext,
  id: string,
  direction: Direction,
  path: PathSegment[],
  position: Tile,
  now: number,
): void {
  const segment = resolveSegment(path, now);
  const facing = segment?.dir ?? direction;
  const animation = computeActorAnimation(facing, segment, now);
  const state = ensureActor(context, id, animation.pose, animation.state);
  const pixel = computeActorPosition(path, now, position);
  state.sprite.position.set(pixel.x + FEET_OFFSET_X, pixel.y + FEET_OFFSET_Y);
  state.sprite.gotoAndStop(animation.frame);
}

function ensureActor(
  context: ActorLayerContext,
  id: string,
  pose: TrainerPose,
  state: ActorState,
): ActorSpriteState {
  const existing = context.sprites.get(id);
  if (existing !== undefined) {
    if (existing.pose === pose && existing.state === state) {
      return existing;
    }
    existing.pose = pose;
    existing.state = state;
    existing.sprite.textures = context.sheet.animations[frameKey(pose, state)];
    return existing;
  }
  const sprite = new AnimatedSprite({
    autoUpdate: false,
    textures: context.sheet.animations[frameKey(pose, state)],
  });
  sprite.anchor.set(0.5, 1);
  context.container.addChild(sprite);
  const created = { pose, sprite, state };
  context.sprites.set(id, created);
  return created;
}

function removeGoneActors(context: ActorLayerContext, present: Set<string>): void {
  for (const id of context.sprites.keys()) {
    if (!present.has(id)) {
      removeActor(context, id);
    }
  }
}

function removeActor(context: ActorLayerContext, id: string): void {
  const state = context.sprites.get(id);
  if (state === undefined) {
    return;
  }
  state.sprite.destroy();
  context.sprites.delete(id);
}

/**
 * The key of an animation in the atlas.
 */
function frameKey(pose: TrainerPose, state: ActorState): string {
  return 'trainer/' + pose + '/' + FRAME_KEY_BY_STATE[state];
}
