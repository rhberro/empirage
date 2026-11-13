import type { GameObjects, Scene } from 'phaser';

import type { Direction, Movement, Tile } from '../api/game-protocol';

type VisualAction = 'idle' | 'running' | 'walking';
export const CELL_SIZE = 16;
export const CHARACTER_ATLAS_KEY = 'male-walking-running';
const FRAME_SEQUENCE = [1, 2, 3, 2];
export type VisualPlayer = {
  movement: Movement | null;
  phase: number;
  sprite: GameObjects.Sprite;
  tile: Tile;
};

export function showAtlasError(scene: Scene): void {
  if (
    scene.textures.exists(CHARACTER_ATLAS_KEY) &&
    scene.textures.get(CHARACTER_ATLAS_KEY).has('idle/south/frame_1')
  ) {
    return;
  }
  const style = {
    backgroundColor: '#191b24',
    color: '#ffaaa4',
    fontFamily: 'monospace',
    fontSize: '10px',
    padding: { x: 8, y: 6 },
    wordWrap: { width: 288 },
  };
  scene.add
    .text(8, 146, 'Sprite indisponível. Falha no atlas do personagem. Recarregue a página.', style)
    .setDepth(30_000)
    .setScrollFactor(0);
}

export function currentPhase(visual: VisualPlayer, now: number): number {
  if (!visual.movement || visual.movement.duration <= 0) {
    return visual.phase;
  }
  const progress = Math.max(
    0,
    Math.min(1, (now - visual.movement.startedAt) / visual.movement.duration),
  );
  return (visual.phase + progress) % 1;
}

export function renderPlayer(visual: VisualPlayer, now: number): void {
  const movement = visual.movement;
  if (!movement) {
    return;
  }
  const elapsed = now - movement.startedAt;
  const progress =
    movement.duration > 0 ? Math.max(0, Math.min(1, elapsed / movement.duration)) : 1;
  const x = movement.from.x + (movement.to.x - movement.from.x) * progress;
  const y = movement.from.y + (movement.to.y - movement.from.y) * progress;
  visual.sprite.setPosition(tileCenter(x), tileCenter(y)).setDepth(tileCenter(y));
  const phase = (visual.phase + progress) % 1;
  const index = Math.floor(phase * FRAME_SEQUENCE.length) % FRAME_SEQUENCE.length;
  const selectedFrame = FRAME_SEQUENCE[index];
  const frame = selectedFrame === undefined ? 2 : selectedFrame;
  const direction = movementDirection(movement);
  visual.sprite.setFrame(frameName(movement.mode, direction, frame));
  if (progress === 1) {
    visual.phase = phase;
    visual.tile = movement.to;
    visual.movement = null;
    visual.sprite.setTexture(CHARACTER_ATLAS_KEY, frameName('idle', direction, 1));
  }
}

export function frameName(action: VisualAction, direction: Direction, frame: number): string {
  return `${action}/${direction}/frame_${frame}`;
}

export function tileCenter(tile: number): number {
  return tile * CELL_SIZE + CELL_SIZE / 2;
}

export function movementDirection(movement: Movement): Direction {
  if (movement.direction === 'left') {
    return 'west';
  }
  if (movement.direction === 'right') {
    return 'east';
  }
  if (
    movement.direction === 'up' ||
    movement.direction === 'up-left' ||
    movement.direction === 'up-right'
  ) {
    return 'north';
  }
  return 'south';
}
