import type { PathSegment, Tile } from '@creatures/contracts/world';

import { readTimelineSegment, resolveTimeline } from './actorTimeline';
import type { Pixel } from './tiles';

/**
 * The world-pixel position of an actor, derived from its walk and the clock.
 *
 * The position is the top-left pixel of the square the actor currently stands
 * on, interpolated between the tiles of the step in course. Timestamps are
 * absolute, so a hidden tab, lag or a reconnect snaps to the right spot when
 * the clock is read again — no elapsed duration is ever accumulated.
 *
 * The rules of the queue are in `actorTimeline`; this is the shorthand the
 * renderer reads every frame.
 */
export function computeActorPosition(path: PathSegment[], now: number, position: Tile): Pixel {
  return resolveTimeline(path, now, position).pixel;
}

/**
 * The segment the actor is on at the given time, when there is one.
 *
 * A walk is contiguous: exactly one segment covers any instant between the
 * first start and the last end, and this returns that segment. It returns
 * nothing before and after the walk, where the actor is idle.
 */
export function resolveSegment(path: PathSegment[], now: number): PathSegment | undefined {
  return readTimelineSegment(path, now);
}
