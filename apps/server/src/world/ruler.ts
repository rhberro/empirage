import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { GameErrorCode } from '@creatures/contracts/game';
import type { CityMap, PathSegment, Tile } from '@creatures/contracts/world';

import { findPath } from '~/world/path';
import type { PathStep } from '~/world/path';
import type { MoveOutcome, WorldRegistry } from '~/world/registry';

/** The step of an orthogonal move, in milliseconds. */
export const ORTHOGONAL_STEP_MS = 300;

/**
 * The step of a diagonal move.
 *
 * A diagonal covers more ground per step, so it must take longer than the
 * orthogonal one: the trainer never looks faster walking diagonally.
 */
export const DIAGONAL_STEP_MS = 424;

export type MoveAnswer = {
  code?: GameErrorCode;
  ok: boolean;
  path: PathSegment[];
  reqId: string;
  type: 'move_result';
  v: number;
  worldRev: number;
};

export type WorldRuler = {
  move(userId: string, reqId: string, target: Tile): MoveAnswer;
};

/**
 * Applies the command of walking to the world.
 *
 * The ruler is the only place a move changes the registry. A command that
 * arrives in the middle of a step does not cancel it: the step in course is
 * completed, and the new walk is planned from the tile it is entering. That
 * keeps the animation continuous on the client while the player keeps
 * clicking.
 */
export function createWorldRuler(registry: WorldRegistry, map: CityMap): WorldRuler {
  function move(userId: string, reqId: string, target: Tile): MoveAnswer {
    const at = registry.now();
    const cached = registry.readCachedMove(userId, reqId, at);
    if (cached !== undefined) {
      return answerWith(registry, userId, cached);
    }
    const outcome = resolveOutcome(registry, map, userId, reqId, target, at);
    registry.cacheMove(userId, reqId, outcome, at);
    return answerWith(registry, userId, outcome);
  }

  return { move };
}

function resolveOutcome(
  registry: WorldRegistry,
  map: CityMap,
  userId: string,
  reqId: string,
  target: Tile,
  at: number,
): MoveOutcome {
  const actor = registry.advance(userId, at);
  if (actor === undefined) {
    return { code: 'invalid_command', ok: false, path: [], reqId };
  }
  const segment = actor.segment;
  if (segment !== undefined) {
    return resolveDuringStep(registry, map, userId, reqId, target, segment, at);
  }
  if (sameTile(actor.position, target)) {
    registry.setPath(userId, [], at);
    return { ok: true, path: [], reqId };
  }
  const found = findPath(map, actor.position, target);
  if (!found.ok) {
    return { code: found.code, ok: false, path: [], reqId };
  }
  const path = stampSteps(found.steps, at);
  registry.setPath(userId, path, at);
  return { ok: true, path, reqId };
}

/**
 * Replans from the tile the current step is entering.
 *
 * The current segment stays at the head of the answer, so the client never
 * sees it disappear between two clicks. A failed plan keeps only the current
 * step: the trainer finishes the animation it already started and stops.
 */
function resolveDuringStep(
  registry: WorldRegistry,
  map: CityMap,
  userId: string,
  reqId: string,
  target: Tile,
  segment: PathSegment,
  at: number,
): MoveOutcome {
  if (sameTile(segment.to, target)) {
    registry.setPath(userId, [segment], at);
    return { ok: true, path: [segment], reqId };
  }
  const found = findPath(map, segment.to, target);
  if (!found.ok) {
    registry.setPath(userId, [segment], at);
    return { code: found.code, ok: false, path: [], reqId };
  }
  const path = [segment, ...stampSteps(found.steps, segment.endsAt)];
  registry.setPath(userId, path, at);
  return { ok: true, path, reqId };
}

function answerWith(registry: WorldRegistry, userId: string, outcome: MoveOutcome): MoveAnswer {
  return {
    code: outcome.code,
    ok: outcome.ok,
    path: outcome.path,
    reqId: outcome.reqId,
    type: 'move_result',
    v: PROTOCOL_VERSION,
    worldRev: registry.nextWorldRev(userId),
  };
}

/**
 * Turns the steps into the absolute times of the server clock.
 *
 * The first step starts now and each next one starts when the previous ends,
 * so the client derives the position from its corrected clock instead of
 * accumulating durations.
 */
function stampSteps(steps: PathStep[], startsAt: number): PathSegment[] {
  const segments: PathSegment[] = [];
  let cursor = startsAt;
  for (const step of steps) {
    const segment: PathSegment = {
      dir: step.dir,
      endsAt: cursor + stepDurationMs(step.from, step.to),
      from: step.from,
      startsAt: cursor,
      to: step.to,
    };
    segments.push(segment);
    cursor = segment.endsAt;
  }
  return segments;
}

/**
 * The duration of a step, derived from its two squares.
 *
 * A diagonal changes both axes; anything else is orthogonal.
 */
export function stepDurationMs(from: Tile, to: Tile): number {
  const diagonal = from.x !== to.x && from.y !== to.y;
  return diagonal ? DIAGONAL_STEP_MS : ORTHOGONAL_STEP_MS;
}

function sameTile(left: Tile, right: Tile): boolean {
  return left.x === right.x && left.y === right.y;
}
