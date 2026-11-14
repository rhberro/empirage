import type { GameObjects, Scene } from 'phaser';
/* eslint-disable max-lines */
import { TintModes } from 'phaser';

import { GAME_TICKS_PER_SECOND } from '../api/game-protocol';
import type { Direction, Tile } from '../api/game-protocol';
import type { HuntMovement } from '../api/hunt-protocol';
import { reconcileHuntMovement } from '../api/hunt-protocol';

type CreatureSprite = GameObjects.Sprite | GameObjects.Rectangle;
type AtlasCompleteHandler = () => void;
type CreatureFeedback = {
  damagedAt: number;
  defeatedAt: number | null;
  displayedHealth: number;
  health: number;
  healthChangedAt: number;
  spawnedAt: number;
};
type CreatureVisual = {
  animated: GameObjects.Sprite | null;
  color: number;
  direction: Direction;
  feedback: CreatureFeedback;
  healthBar: GameObjects.Graphics;
  maximumHealth: number;
  movement: HuntMovement | null;
  faceTargetUntil: number;
  sprite: CreatureSprite;
  spriteOffsetY: number;
  target: Tile | null;
  tile: Tile;
};

export type CreatureSpec = {
  direction: Direction;
  faceTargetUntil: number;
  health: number;
  key: string;
  maximumHealth: number;
  movement: HuntMovement | null;
  speciesId: number | null;
  target: Tile | null;
  tile: Tile;
};

const FRAME_INTERVAL_MS = 250;
const ALLY_KEY = 'ally';
const DAMAGE_DURATION_MS = 220;
const TRANSITION_DURATION_MS = 320;

function hslColor(hue: number): string {
  function channel(offset: number): string {
    const k = (offset + hue / 30) % 12;
    const value = 0.18 - 0.07 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0');
  }
  return channel(0) + channel(8) + channel(4);
}

function creatureAtlasKey(speciesId: number): string {
  return `creature-${speciesId}`;
}

function creatureFrame(direction: Direction, frame: number): string {
  return `${direction}/frame${frame}`;
}

function movementDirection(movement: HuntMovement): Direction {
  const west = movement.direction === 'left';
  const east = movement.direction === 'right';
  const north = movement.direction === 'up';
  return west ? 'west' : east ? 'east' : north ? 'north' : 'south';
}

function directionTowards(from: Tile, target: Tile, fallback: Direction): Direction {
  const horizontalDistance = target.x - from.x;
  const verticalDistance = target.y - from.y;
  if (Math.abs(horizontalDistance) >= Math.abs(verticalDistance) && horizontalDistance !== 0) {
    return horizontalDistance < 0 ? 'west' : 'east';
  }
  if (verticalDistance !== 0) {
    return verticalDistance < 0 ? 'north' : 'south';
  }
  return fallback;
}

function movementProgress(movement: HuntMovement, now: number): number {
  const duration = (movement.durationTicks / GAME_TICKS_PER_SECOND) * 1000;
  if (duration <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, (now - movement.startTime) / duration));
}

export class HuntCreatures {
  private readonly overlay: GameObjects.Container;
  private readonly scene: Scene;
  private readonly creatures = new Map<string, CreatureVisual>();
  private readonly feedback = new Map<string, CreatureFeedback>();
  private readonly present = new Set<string>();
  private readonly reducedMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  private readonly pendingAtlases = new Set<number>();
  private readonly onAtlasComplete: AtlasCompleteHandler;
  private gridOriginX = 0;
  private gridOriginY = 0;
  private tileSize = 16;

  public constructor(
    scene: Scene,
    overlay: GameObjects.Container,
    onAtlasComplete: AtlasCompleteHandler,
  ) {
    this.scene = scene;
    this.overlay = overlay;
    this.onAtlasComplete = onAtlasComplete;
  }

  public configure(
    gridWidth: number,
    gridHeight: number,
    tileSize: number,
    width: number,
    height: number,
  ): void {
    this.tileSize = tileSize;
    this.gridOriginX = (width - gridWidth * tileSize) / 2;
    this.gridOriginY = (height - gridHeight * tileSize) / 2;
  }

  public clear(): void {
    this.present.clear();
  }

  public reset(): void {
    for (const visual of this.creatures.values()) {
      visual.sprite.destroy();
      visual.healthBar.destroy();
    }
    this.creatures.clear();
    this.feedback.clear();
  }

  public finish(now: number): void {
    for (const [key, visual] of this.creatures) {
      if (!this.present.has(key) && visual.feedback.defeatedAt === null) {
        visual.feedback.defeatedAt = now;
        visual.feedback.health = 0;
        visual.feedback.healthChangedAt = now;
      }
    }
  }

  public add(spec: CreatureSpec, now: number): void {
    this.present.add(spec.key);
    const existing = this.creatures.get(spec.key);
    if (existing && this.updateExisting(existing, spec, now)) {
      return;
    }
    const initialTile = spec.movement ? spec.movement.fromTile : spec.tile;
    const x = this.screenX(initialTile.x);
    const y = this.screenY(initialTile.y);
    let animated: GameObjects.Sprite | null = null;
    let sprite: CreatureSprite;
    let spriteOffsetY = 0;
    const hue = spec.speciesId === null ? 0 : (spec.speciesId * 47) % 360;
    const color = Number.parseInt(hslColor(hue), 16);
    if (spec.speciesId === null || !this.ensureCreatureAtlas(spec.speciesId)) {
      spriteOffsetY = -8;
      sprite = this.scene.add.rectangle(x, y + spriteOffsetY, 16, 16, color);
    } else {
      animated = this.scene.add.sprite(
        x,
        y,
        creatureAtlasKey(spec.speciesId),
        creatureFrame(spec.direction, 1),
      );
      animated.setOrigin(0.5, 0.75);
      sprite = animated;
    }
    const feedback = this.resolveFeedback(spec, now);
    const healthBar = this.scene.add.graphics();
    this.overlay.add(sprite);
    this.overlay.add(healthBar);
    this.creatures.set(spec.key, {
      animated,
      color,
      direction: existing ? existing.direction : spec.direction,
      faceTargetUntil: spec.faceTargetUntil,
      feedback,
      healthBar,
      maximumHealth: spec.maximumHealth,
      movement: existing ? existing.movement : spec.movement,
      sprite,
      spriteOffsetY,
      target: spec.target,
      tile: initialTile,
    });
  }

  private updateExisting(visual: CreatureVisual, spec: CreatureSpec, now: number): boolean {
    visual.movement = reconcileHuntMovement(visual.movement, spec.movement, spec.tile);
    visual.faceTargetUntil = spec.faceTargetUntil;
    visual.target = spec.target;
    visual.tile = spec.tile;
    this.finishAuthoritativeMovement(visual, now);
    visual.feedback = this.resolveFeedback(spec, now);
    visual.maximumHealth = spec.maximumHealth;
    if (visual.animated || spec.speciesId === null || !this.ensureCreatureAtlas(spec.speciesId)) {
      return true;
    }
    visual.sprite.destroy();
    visual.healthBar.destroy();
    return false;
  }

  private resolveFeedback(spec: CreatureSpec, now: number): CreatureFeedback {
    const feedback = this.feedback.get(spec.key);
    if (feedback) {
      if (spec.health < feedback.health) {
        feedback.damagedAt = now;
      }
      if (spec.health !== feedback.health) {
        feedback.displayedHealth = feedback.health;
        feedback.healthChangedAt = now;
      }
      if (spec.health === 0 && feedback.health > 0) {
        feedback.defeatedAt = now;
      } else if (spec.health > 0 && feedback.health === 0) {
        feedback.defeatedAt = null;
        feedback.spawnedAt = now;
      }
      feedback.health = spec.health;
      return feedback;
    }
    const created = {
      damagedAt: 0,
      defeatedAt: spec.health === 0 ? now : null,
      displayedHealth: spec.health,
      health: spec.health,
      healthChangedAt: now,
      spawnedAt: now,
    };
    this.feedback.set(spec.key, created);
    return created;
  }

  public update(now: number): void {
    const frame = (Math.floor(now / FRAME_INTERVAL_MS) % 2) + 1;
    for (const [key, visual] of this.creatures) {
      const movement = visual.movement;
      let tileX = visual.tile.x;
      let tileY = visual.tile.y;
      if (movement) {
        const progress = movementProgress(movement, now);
        tileX = movement.fromTile.x + (movement.toTile.x - movement.fromTile.x) * progress;
        tileY = movement.fromTile.y + (movement.toTile.y - movement.fromTile.y) * progress;
        visual.direction = movementDirection(movement);
        if (progress >= 1) {
          visual.tile = movement.toTile;
          visual.movement = null;
        }
      }
      if (!visual.movement && visual.target && now <= visual.faceTargetUntil) {
        visual.direction = directionTowards(visual.tile, visual.target, visual.direction);
      }
      const x = this.screenX(tileX);
      const y = this.screenY(tileY);
      visual.sprite.setPosition(x, y + visual.spriteOffsetY);
      this.renderHealthBar(visual, x, y, now);
      if (visual.animated) {
        visual.animated.setFrame(creatureFrame(visual.direction, frame));
      }
      this.updateFeedback(visual, now);
      if (
        visual.feedback.defeatedAt !== null &&
        !this.present.has(key) &&
        now - visual.feedback.defeatedAt >= TRANSITION_DURATION_MS
      ) {
        visual.sprite.destroy();
        visual.healthBar.destroy();
        this.creatures.delete(key);
        this.feedback.delete(key);
      }
    }
    this.overlay.sort('y');
  }

  public fastForward(now: number): void {
    this.update(now);
  }

  private finishAuthoritativeMovement(visual: CreatureVisual, now: number): void {
    const movement = visual.movement;
    if (!movement || movementProgress(movement, now) < 1) {
      return;
    }
    visual.tile = movement.toTile;
    visual.movement = null;
    visual.sprite.setPosition(
      this.screenX(movement.toTile.x),
      this.screenY(movement.toTile.y) + visual.spriteOffsetY,
    );
  }

  private updateFeedback(visual: CreatureVisual, now: number): void {
    const { feedback, sprite, animated } = visual;
    const damageElapsed = now - feedback.damagedAt;
    const damaged =
      damageElapsed >= 0 &&
      damageElapsed < DAMAGE_DURATION_MS &&
      (this.reducedMotion || Math.floor(damageElapsed / 70) % 2 === 0);
    const arrival = Math.min(1, Math.max(0, (now - feedback.spawnedAt) / TRANSITION_DURATION_MS));
    const departure =
      feedback.defeatedAt === null
        ? 0
        : Math.min(1, Math.max(0, (now - feedback.defeatedAt) / TRANSITION_DURATION_MS));
    const alpha = this.reducedMotion
      ? feedback.health > 0
        ? 1
        : 0.25
      : arrival * (1 - departure * 0.75);
    sprite.setAlpha(alpha);
    sprite.setScale(this.reducedMotion ? 1 : 0.9 + arrival * 0.1 - departure * 0.1);
    if (animated) {
      if (damaged) {
        animated.setTint(0xffd2bd).setTintMode(TintModes.FILL);
      } else {
        animated.clearTint();
      }
    } else {
      (sprite as GameObjects.Rectangle).setFillStyle(damaged ? 0xffd2bd : visual.color);
    }
  }

  private renderHealthBar(visual: CreatureVisual, x: number, y: number, now: number): void {
    const width = Math.max(12, this.tileSize);
    const height = 2;
    const barX = Math.round(x - width / 2);
    const barY = Math.round(y - this.tileSize);
    const progress = this.reducedMotion
      ? 1
      : Math.min(1, (now - visual.feedback.healthChangedAt) / 220);
    const shownHealth =
      visual.feedback.displayedHealth +
      (visual.feedback.health - visual.feedback.displayedHealth) * progress;
    const healthRatio = Math.max(0, Math.min(1, shownHealth / visual.maximumHealth));
    const color = healthRatio > 0.5 ? 0x4caf50 : healthRatio > 0.2 ? 0xf0b429 : 0xd64545;
    visual.healthBar.clear();
    visual.healthBar.fillStyle(0x111111, 0.9);
    visual.healthBar.fillRect(barX - 1, barY - 1, width + 2, height + 2);
    visual.healthBar.fillStyle(color, 1);
    visual.healthBar.fillRect(barX, barY, Math.round(width * healthRatio), height);
    const departure =
      visual.feedback.defeatedAt === null
        ? 0
        : Math.min(1, Math.max(0, (now - visual.feedback.defeatedAt) / TRANSITION_DURATION_MS));
    visual.healthBar.setAlpha(1 - departure);
    visual.healthBar.setDepth(y + visual.spriteOffsetY + 0.1);
  }

  private screenX(tileX: number): number {
    return this.gridOriginX + tileX * this.tileSize + this.tileSize / 2;
  }

  private screenY(tileY: number): number {
    return this.gridOriginY + tileY * this.tileSize + this.tileSize / 2;
  }

  private ensureCreatureAtlas(speciesId: number): boolean {
    const key = creatureAtlasKey(speciesId);
    if (this.scene.textures.exists(key)) {
      return true;
    }
    if (this.pendingAtlases.has(speciesId)) {
      return false;
    }
    this.pendingAtlases.add(speciesId);
    const imageUrl = `/assets/creatures/atlases/${speciesId}.png`;
    const dataUrl = `/assets/creatures/atlases/${speciesId}.json`;
    this.scene.load.atlas(key, imageUrl, dataUrl);
    this.scene.load.once('complete', this.onAtlasComplete);
    this.scene.load.start();
    return false;
  }
}

export const CREATURE_ALLY_KEY = ALLY_KEY;
