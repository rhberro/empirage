import type { Tile } from '@creatures/contracts/world';

/**
 * Reads the square of a walk command.
 *
 * The shape is checked here and the bounds are judged by the world: a broken
 * payload is an invalid message, while a square outside the map is a command
 * refused with `invalid_target`.
 */
export function readMoveTarget(value: unknown): Tile | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { x?: unknown; y?: unknown };
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
    return null;
  }
  if (!Number.isInteger(candidate.x) || !Number.isInteger(candidate.y)) {
    return null;
  }
  return { x: candidate.x, y: candidate.y };
}
