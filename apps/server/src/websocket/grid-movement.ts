import type { Direction, Position } from './game-types.ts';

export type GridVector = { direction: Direction; x: number; y: number };

export function positionAfterVector(position: Position, vector: GridVector): Position {
  return { x: position.x + vector.x, y: position.y + vector.y };
}

export function isPositionWithin(position: Position, width: number, height: number): boolean {
  return position.x >= 0 && position.x < width && position.y >= 0 && position.y < height;
}

export function positionKey(position: Position): string {
  return `${position.x}:${position.y}`;
}
