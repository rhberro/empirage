import { findPath } from '@creatures/contracts/path';
import type { CityMap, PathSegment, Tile } from '@creatures/contracts/world';
import { stepDurationMs } from '@creatures/contracts/world';

import { resolveSegment } from './steps';

/**
 * The part of the world the prediction reads.
 */
export type PredictionState = {
  path: PathSegment[];
  you: { position: Tile } | null;
};

/**
 * The tile the next step starts from.
 *
 * A step in course already occupies the destination it is heading to, so the
 * next decision starts from there, not from the tile the actor is leaving. This
 * is the same rule the server applies when a click arrives mid-step.
 */
export function readOrigin(state: PredictionState, now: number): Tile | null {
  if (state.you === null) {
    return null;
  }
  const current = resolveSegment(state.path, now);
  return current === undefined ? state.you.position : current.to;
}

/**
 * The first step of a click, predicted locally.
 *
 * The client runs the same weighted search as the server, from the same tile,
 * so the predicted step is the one the server is about to accept. Only the
 * first step is predicted: the rest of the walk belongs to the answer.
 */
export function buildPrediction(input: {
  map: CityMap;
  now: number;
  state: PredictionState;
  target: Tile;
}): PathSegment | null {
  const origin = readOrigin(input.state, input.now);
  if (origin === null) {
    return null;
  }
  const current = resolveSegment(input.state.path, input.now);
  const startsAt = current === undefined ? input.now : current.endsAt;
  const result = findPath(input.map, origin, input.target);
  if (!result.ok || result.steps.length === 0) {
    return null;
  }
  const step = result.steps[0];
  if (step === undefined) {
    return null;
  }
  const duration = stepDurationMs(step.from, step.to);
  return {
    dir: step.dir,
    endsAt: startsAt + duration,
    from: { x: step.from.x, y: step.from.y },
    startsAt,
    to: { x: step.to.x, y: step.to.y },
  };
}

/**
 * Keeps the predicted step and replaces the rest of the walk with the answer.
 *
 * When the server accepts the same step the client predicted, the step already
 * on screen is not restarted: its timestamps are kept and the following steps
 * are shifted to begin where it ends. A different or missing step means the
 * prediction lost, and the answer is taken whole.
 */
export function mergeMoveResult(
  prediction: PathSegment | null,
  serverPath: PathSegment[],
): PathSegment[] {
  if (prediction === null) {
    return serverPath;
  }
  const index = serverPath.findIndex(function isPredicted(segment: PathSegment): boolean {
    return sameStep(segment, prediction);
  });
  if (index < 0) {
    return serverPath;
  }
  const before = serverPath.slice(0, index);
  const duration = prediction.endsAt - prediction.startsAt;
  const previousEnd = before.at(-1)?.endsAt;
  const startsAt =
    previousEnd === undefined ? prediction.startsAt : Math.max(prediction.startsAt, previousEnd);
  const matched: PathSegment = {
    ...prediction,
    endsAt: startsAt + duration,
    startsAt,
  };
  return [...before, matched, ...shiftSegments(serverPath.slice(index + 1), matched.endsAt)];
}

/**
 * Whether two steps go from the same tile to the same tile.
 *
 * The direction and the timestamps are not part of the identity: the server may
 * have planned the same step a few milliseconds later.
 */
export function sameStep(left: PathSegment, right: PathSegment): boolean {
  return (
    left.from.x === right.from.x &&
    left.from.y === right.from.y &&
    left.to.x === right.to.x &&
    left.to.y === right.to.y
  );
}

function shiftSegments(segments: PathSegment[], startAt: number): PathSegment[] {
  let cursor = startAt;
  return segments.map(function shift(segment: PathSegment): PathSegment {
    const duration = segment.endsAt - segment.startsAt;
    const shifted: PathSegment = {
      ...segment,
      endsAt: cursor + duration,
      startsAt: cursor,
    };
    cursor += duration;
    return shifted;
  });
}
