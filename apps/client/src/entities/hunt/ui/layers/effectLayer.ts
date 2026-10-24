/* eslint-disable max-lines */
/* eslint-disable unicorn/no-array-fill-with-reference-type -- Pixi `Graphics.fill` is not `Array.fill` */
import type {
  HuntCreatureActor,
  HuntRuntimeEvent,
  HuntTrainerActor,
  HuntWaveEvent,
} from '@creatures/contracts/huntSim';
import type { Tile } from '@creatures/contracts/world';
import { Container, Graphics, Text } from 'pixi.js';

import { readAbilityElement } from '~/entities/hunt/model/abilityElement';
import {
  computeCaptureBallVisual,
  LEVEL_UP_TEXT_MS,
  type CaptureBallVisual,
} from '~/entities/hunt/model/huntAnimation';
import { CAST_PROJECTILE_MS } from '~/entities/hunt/model/huntEvents';
import { elementColor } from '~/entities/hunt/ui/colors';
import { computeActorPosition } from '~/entities/world/model/steps';
import { TILE_SIZE_PX, tileToPixel } from '~/entities/world/model/tiles';

export type EffectLayerInput = {
  creatures: HuntCreatureActor[];
  events: HuntRuntimeEvent[];
  trainer: HuntTrainerActor;
  waves: HuntWaveEvent[];
};

export type EffectLayer = {
  /** The tiles of area waves, drawn under the creatures. */
  waves: Container;
  /** Projectiles and damage numbers, drawn over the creatures. */
  fx: Container;
  update(input: EffectLayerInput, now: number): void;
};

const WAVE_FADE_MS = 200;
const DAMAGE_LINGER_MS = 600;
const DAMAGE_RISE_PX = 8;

type FloatingNumber = {
  text: Text;
};

type EffectLayerContext = {
  corpsePositions: Map<string, { x: number; y: number }>;
  damage: Map<string, FloatingNumber>;
  fx: Container;
  levelUps: Map<string, FloatingNumber>;
  waveGraphics: Graphics;
  waves: Container;
  projectileGraphics: Graphics;
};

export function createEffectLayer(): EffectLayer {
  const waves = new Container();
  const waveGraphics = new Graphics();
  waves.addChild(waveGraphics);
  const fx = new Container();
  const projectileGraphics = new Graphics();
  const damage = new Container();
  fx.addChild(projectileGraphics);
  fx.addChild(damage);
  const context: EffectLayerContext = {
    corpsePositions: new Map<string, { x: number; y: number }>(),
    damage: new Map<string, FloatingNumber>(),
    fx,
    levelUps: new Map<string, FloatingNumber>(),
    projectileGraphics,
    waveGraphics,
    waves,
  };
  return {
    fx,
    update: function update(input: EffectLayerInput, now: number): void {
      updateEffects(context, input, now);
    },
    waves,
  };
}

function updateEffects(context: EffectLayerContext, input: EffectLayerInput, now: number): void {
  drawWaves(context, input.waves, now);
  drawProjectiles(context, input.creatures, input.events, now);
  drawCaptureBalls(context, input.trainer, input.creatures, input.events, now);
  drawDamage(context, input.creatures, input.events, now);
  drawLevelUps(context, input.creatures, input.events, now);
}

function drawWaves(context: EffectLayerContext, waves: HuntWaveEvent[], now: number): void {
  const graphics = context.waveGraphics;
  graphics.clear();
  for (const wave of waves) {
    const color = elementColor(wave.element);
    for (const cell of wave.tiles) {
      const alpha = readWaveAlpha(cell.arrivalAt, now);
      if (alpha <= 0) {
        continue;
      }
      const pixel = tileToPixel(cell.tile);
      graphics.rect(pixel.x, pixel.y, TILE_SIZE_PX, TILE_SIZE_PX);
      graphics.fill({ alpha, color });
    }
  }
}

function readWaveAlpha(arrivalAt: number, now: number): number {
  const elapsed = now - arrivalAt;
  if (elapsed < 0 || elapsed >= WAVE_FADE_MS) {
    return 0;
  }
  return 1 - elapsed / WAVE_FADE_MS;
}

function drawProjectiles(
  context: EffectLayerContext,
  creatures: HuntCreatureActor[],
  events: HuntRuntimeEvent[],
  now: number,
): void {
  const graphics = context.projectileGraphics;
  graphics.clear();
  const byId = buildActorMap(creatures);
  for (const event of events) {
    if (event.type !== 'ability_cast' || event.targetTile === undefined) {
      continue;
    }
    const progress = readProjectileProgress(event, now);
    if (progress === null) {
      continue;
    }
    const caster = byId.get(event.actorId);
    if (caster === undefined) {
      continue;
    }
    drawProjectile(
      graphics,
      caster,
      event.targetTile,
      progress,
      readAbilityElement(event.abilitySlug),
      now,
    );
  }
}

/**
 * How far the projectile is between the caster and the target.
 *
 * The server sends the impact time; an older event without it falls back to the
 * fixed duration of the first version of the effect.
 */
function readProjectileProgress(
  event: Extract<HuntRuntimeEvent, { type: 'ability_cast' }>,
  now: number,
): number | null {
  const end = event.impactAt ?? event.at + (event.travelMs ?? CAST_PROJECTILE_MS);
  const duration = end - event.at;
  const elapsed = now - event.at;
  if (duration <= 0 || elapsed < 0 || elapsed >= duration) {
    return null;
  }
  return elapsed / duration;
}

function drawProjectile(
  graphics: Graphics,
  caster: HuntCreatureActor,
  targetTile: Tile,
  progress: number,
  element: ReturnType<typeof readAbilityElement>,
  now: number,
): void {
  const from = centerOf(caster, now);
  const to = centerOfTile(targetTile);
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;
  const fade = 1 - progress;
  graphics.circle(x, y, 2);
  graphics.fill({ alpha: Math.max(0, fade), color: elementColor(element) });
}

function centerOf(actor: HuntCreatureActor, now: number): { x: number; y: number } {
  const pixel = computeActorPosition(
    actor.segment === undefined ? [] : [actor.segment],
    now,
    actor.tile,
  );
  return { x: pixel.x + TILE_SIZE_PX / 2, y: pixel.y + TILE_SIZE_PX / 2 };
}

function centerOfTile(tile: Tile): { x: number; y: number } {
  const pixel = tileToPixel(tile);
  return { x: pixel.x + TILE_SIZE_PX / 2, y: pixel.y + TILE_SIZE_PX / 2 };
}

function centerOfTrainer(trainer: HuntTrainerActor, now: number): { x: number; y: number } {
  const pixel = computeActorPosition(
    trainer.segment === undefined ? [] : [trainer.segment],
    now,
    trainer.tile,
  );
  return { x: pixel.x + TILE_SIZE_PX / 2, y: pixel.y + TILE_SIZE_PX / 2 };
}

function drawCaptureBalls(
  context: EffectLayerContext,
  trainer: HuntTrainerActor,
  creatures: HuntCreatureActor[],
  events: HuntRuntimeEvent[],
  now: number,
): void {
  const byId = buildActorMap(creatures);
  const captureResult = new Map<string, boolean>();
  for (const event of events) {
    if (event.type === 'capture') {
      captureResult.set(event.actorId, event.success);
    }
  }
  for (const event of events) {
    if (event.type !== 'death' || event.killerId === undefined) {
      continue;
    }
    const visual = computeCaptureBallVisual(now - event.at);
    if (visual.visible) {
      drawFlyingBall(context, trainer, byId, captureResult, event.actorId, now, visual);
    }
  }
}

function drawFlyingBall(
  context: EffectLayerContext,
  trainer: HuntTrainerActor,
  byId: Map<string, HuntCreatureActor>,
  captureResult: Map<string, boolean>,
  actorId: string,
  now: number,
  visual: CaptureBallVisual,
): void {
  const target = byId.get(actorId);
  const to = target === undefined ? context.corpsePositions.get(actorId) : centerOf(target, now);
  if (to === undefined) {
    return;
  }
  context.corpsePositions.set(actorId, to);
  const success = captureResult.get(actorId) ?? false;
  drawCaptureBall(context.projectileGraphics, centerOfTrainer(trainer, now), to, visual, success);
}

function drawCaptureBall(
  graphics: Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  visual: CaptureBallVisual,
  success: boolean,
): void {
  const x = from.x + (to.x - from.x) * visual.progress;
  const y = from.y + (to.y - from.y) * visual.progress;
  const color = visual.result ? (success ? 0x54d184 : 0xe04b52) : 0xf0f3f6;
  graphics.circle(x, y, 3);
  graphics.fill({ alpha: 1, color });
  graphics.circle(x, y, 0.8);
  graphics.fill({ alpha: 1, color: 0x0a0e12 });
}

function drawDamage(
  context: EffectLayerContext,
  creatures: HuntCreatureActor[],
  events: HuntRuntimeEvent[],
  now: number,
): void {
  const byId = buildActorMap(creatures);
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type !== 'damage') {
      continue;
    }
    const key = `${event.targetId}:${event.at}`;
    if (now - event.at > DAMAGE_LINGER_MS) {
      continue;
    }
    seen.add(key);
    const target = byId.get(event.targetId);
    if (target === undefined) {
      continue;
    }
    const floating = ensureFloating(context, key, event.amount);
    const center = centerOf(target, now);
    const progress = (now - event.at) / DAMAGE_LINGER_MS;
    floating.text.position.set(center.x, center.y - TILE_SIZE_PX - progress * DAMAGE_RISE_PX);
    floating.text.alpha = 1 - progress;
  }
  for (const key of context.damage.keys()) {
    if (!seen.has(key)) {
      removeFloating(context, key);
    }
  }
}

function ensureFloating(context: EffectLayerContext, key: string, amount: number): FloatingNumber {
  const existing = context.damage.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const text = new Text({
    anchor: { x: 0.5, y: 1 },
    style: {
      fill: 0xff6b6b,
      fontFamily: 'monospace',
      fontSize: 8,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    },
    text: `-${amount}`,
  });
  context.fx.addChild(text);
  const created = { text };
  context.damage.set(key, created);
  return created;
}

function removeFloating(context: EffectLayerContext, key: string): void {
  const floating = context.damage.get(key);
  if (floating === undefined) {
    return;
  }
  floating.text.destroy();
  context.damage.delete(key);
}

function drawLevelUps(
  context: EffectLayerContext,
  creatures: HuntCreatureActor[],
  events: HuntRuntimeEvent[],
  now: number,
): void {
  const byId = buildActorMap(creatures);
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type !== 'level_up') {
      continue;
    }
    const elapsed = now - event.at;
    if (elapsed < 0 || elapsed > LEVEL_UP_TEXT_MS) {
      continue;
    }
    const key = `${event.actorId}:${event.at}`;
    seen.add(key);
    const target = byId.get(event.actorId);
    if (target === undefined) {
      continue;
    }
    const floating = ensureLevelText(context, key, event.level);
    const center = centerOf(target, now);
    const progress = elapsed / LEVEL_UP_TEXT_MS;
    floating.text.position.set(center.x, center.y - TILE_SIZE_PX - progress * DAMAGE_RISE_PX);
    floating.text.alpha = 1 - progress;
  }
  for (const key of context.levelUps.keys()) {
    if (!seen.has(key)) {
      removeLevelText(context, key);
    }
  }
}

function ensureLevelText(context: EffectLayerContext, key: string, level: number): FloatingNumber {
  const existing = context.levelUps.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const label = `Nv. ${level}`;
  const text = new Text({
    anchor: { x: 0.5, y: 1 },
    style: {
      fill: 0xffd166,
      fontFamily: 'monospace',
      fontSize: 8,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    },
    text: label,
  });
  context.fx.addChild(text);
  const created = { text };
  context.levelUps.set(key, created);
  return created;
}

function removeLevelText(context: EffectLayerContext, key: string): void {
  const floating = context.levelUps.get(key);
  if (floating === undefined) {
    return;
  }
  floating.text.destroy();
  context.levelUps.delete(key);
}

function buildActorMap(creatures: HuntCreatureActor[]): Map<string, HuntCreatureActor> {
  return new Map(creatures.map(creatureEntry));
}

function creatureEntry(creature: HuntCreatureActor): [string, HuntCreatureActor] {
  return [creature.id, creature];
}
