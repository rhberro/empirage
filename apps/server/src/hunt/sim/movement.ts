import type { CityMap } from '@creatures/contracts/world';
import { isWalkableTile } from '@creatures/contracts/world';
import type { Direction, PathSegment, Tile } from '@creatures/contracts/world';

import { directionBetween, stepDuration } from '~/hunt/sim/geometry';
import type { SimTrainer } from '~/hunt/sim/types';
import { sameTile } from '~/hunt/sim/types';
import { findPath } from '~/world/path';

/** The longest trail the trainer keeps. */
export const MAX_TRAINER_TRAIL = 8;

/** How many squares behind the active creature the trainer aims at. */
const TRAINER_GAP = 4;

/**
 * An actor that walks one square at a time.
 *
 * Both a creature and the trainer fit here: the movement only touches the
 * confirmed tile, the facing and the step in course.
 */
export type SimMover = {
  dir: Direction;
  segment?: PathSegment;
  tile: Tile;
};

/**
 * Starts one step, if the actor is not already in the middle of another.
 *
 * The confirmed tile only changes when the step ends. Until then the segment is
 * the whole truth the client needs to interpolate the walk.
 */
export function startStep(
  mover: SimMover,
  to: Tile,
  now: number,
  map: CityMap,
  isBlocked?: (tile: Tile) => boolean,
): boolean {
  if (mover.segment !== undefined) {
    return false;
  }
  if (sameTile(mover.tile, to) || !isWalkableTile(map, to)) {
    return false;
  }
  if (isBlocked !== undefined && isBlocked(to)) {
    return false;
  }
  const dir = directionBetween(mover.tile, to);
  const segment: PathSegment = {
    dir,
    endsAt: now + stepDuration(mover.tile, to),
    from: { x: mover.tile.x, y: mover.tile.y },
    startsAt: now,
    to: { x: to.x, y: to.y },
  };
  mover.dir = dir;
  mover.segment = segment;
  return true;
}

/**
 * Confirms the step in course when its end is reached.
 *
 * Returns whether a step was confirmed, which is what tells the caller to
 * publish the fact and to move the trail forward.
 */
export function finishStep(mover: SimMover, now: number): boolean {
  const segment = mover.segment;
  if (segment === undefined || segment.endsAt > now) {
    return false;
  }
  mover.tile = { x: segment.to.x, y: segment.to.y };
  mover.dir = segment.dir;
  mover.segment = undefined;
  return true;
}

/**
 * The first square of the walk to a destination, or null when there is none.
 *
 * The occupancy test travels with the search, so the walk routes around the
 * actors instead of stopping at the first occupied square.
 */
export function nextStepToward(
  map: CityMap,
  from: Tile,
  to: Tile,
  isBlocked?: (tile: Tile) => boolean,
): Tile | null {
  if (sameTile(from, to)) {
    return null;
  }
  const result = findPath(map, from, to, isBlocked);
  if (!result.ok || result.steps.length === 0) {
    return null;
  }
  const step = result.steps[0];
  if (step === undefined) {
    return null;
  }
  const tile = { x: step.to.x, y: step.to.y };
  if (isBlocked !== undefined && isBlocked(tile)) {
    return null;
  }
  return tile;
}

/**
 * Starts one step of a walk to the destination.
 */
export function stepToward(
  mover: SimMover,
  destination: Tile,
  now: number,
  map: CityMap,
  isBlocked?: (tile: Tile) => boolean,
): boolean {
  if (mover.segment !== undefined) {
    return false;
  }
  const next = nextStepToward(map, mover.tile, destination, isBlocked);
  if (next === null) {
    return false;
  }
  return startStep(mover, next, now, map, isBlocked);
}

/**
 * Keeps the trail of the trainer and walks it towards the active creature.
 *
 * The trail holds the squares the creature passed, the newest at the end. The
 * trainer aims four entries back, which is three squares behind the creature,
 * and takes one step per call. A trail shorter than that means the hunt just
 * began: the trainer waits where it is.
 */
export function advanceTrainer(
  trainer: SimTrainer,
  playerTile: Tile,
  now: number,
  map: CityMap,
  isBlocked?: (tile: Tile) => boolean,
): void {
  pushTrail(trainer.trail, playerTile);
  if (trainer.segment !== undefined) {
    return;
  }
  if (trainer.trail.length < TRAINER_GAP) {
    return;
  }
  const target = trainer.trail[trainer.trail.length - TRAINER_GAP];
  if (target === undefined || sameTile(trainer.tile, target)) {
    return;
  }
  // The trainer follows the trail, it does not route around actors: the walk
  // is computed against the terrain only, and a blocked first square makes it
  // wait where it is until the next event.
  const next = nextStepToward(map, trainer.tile, target);
  if (next === null) {
    return;
  }
  startStep(trainer, next, now, map, isBlocked);
}

/**
 * Appends a tile to a trail, dropping the oldest entries beyond the limit.
 */
export function pushTrail(trail: Tile[], tile: Tile): void {
  const last = trail.at(-1);
  if (last !== undefined && sameTile(last, tile)) {
    return;
  }
  trail.push({ x: tile.x, y: tile.y });
  while (trail.length > MAX_TRAINER_TRAIL) {
    trail.shift();
  }
}
