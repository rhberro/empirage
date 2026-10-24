import type { PathSegment, Tile } from '@creatures/contracts/world';

import { TILE_SIZE_PX, tileToPixel, type Pixel } from './tiles';

/**
 * How many segments a live actor keeps.
 *
 * The client receives one segment per step, and the buffer may deliver the next
 * one before the current ends. Four is enough to cross a slow frame and still
 * remember the step in course.
 */
export const MAX_TIMELINE_SEGMENTS = 4;

/**
 * How far the render may drift from the confirmed tile before it snaps.
 *
 * A drift smaller than two tiles is a late or early packet and is smoothed by
 * the interpolation itself; a larger one means a lost step or a teleport, and
 * showing the truth is better than sliding through the map.
 */
const SNAP_DISTANCE_PX = TILE_SIZE_PX * 2;

/**
 * The queue of steps of one actor.
 *
 * The segments are absolute: every one carries the server times it starts and
 * ends, so the renderer never accumulates elapsed durations. The queue is what
 * lets a step that arrives before the previous one ends be kept instead of
 * replacing it and pulling the sprite backwards.
 */
export type ActorTimeline = {
  segments: PathSegment[];
};

/**
 * Where an actor is at a given time, and whether it is between two tiles.
 */
export type TimelineFrame = {
  /** Whether the clock is inside a step. */
  moving: boolean;
  /** The whole-pixel position of the feet. */
  pixel: Pixel;
  /** The step the clock is inside, when there is one. */
  segment?: PathSegment;
};

export function createTimeline(): ActorTimeline {
  return { segments: [] };
}

/**
 * Forgets the queue and optionally starts it with one segment.
 *
 * A snapshot replaces the timeline: the actors it carries are the truth of the
 * connection, and anything queued before it belongs to a past that may not have
 * happened.
 */
export function resetTimeline(timeline: ActorTimeline, segment?: PathSegment): void {
  timeline.segments = segment === undefined ? [] : [segment];
}

/**
 * Appends a step, replacing the future when the server corrects it.
 *
 * A repeated segment is ignored, so the same step travelling in two deltas does
 * not grow the queue. A segment that starts before the last one is a correction:
 * it replaces everything from its start onward, and the past is kept.
 */
export function pushSegment(timeline: ActorTimeline, segment: PathSegment): void {
  if (segment.endsAt <= segment.startsAt) {
    return;
  }
  if (hasSegment(timeline.segments, segment)) {
    return;
  }
  const correctionAt = timeline.segments.findIndex(function startsAtOrAfter(
    queued: PathSegment,
  ): boolean {
    return queued.startsAt >= segment.startsAt;
  });
  if (correctionAt >= 0) {
    timeline.segments.splice(correctionAt);
  }
  timeline.segments.push(segment);
  timeline.segments.sort(compareSegments);
  if (timeline.segments.length > MAX_TIMELINE_SEGMENTS) {
    timeline.segments.splice(0, timeline.segments.length - MAX_TIMELINE_SEGMENTS);
  }
}

/**
 * The position of an actor at a time, from its queue and its confirmed tile.
 *
 * Before the first step the actor is on its start tile; inside a step it is
 * between the two tiles; in a gap between steps it is held on the end of the
 * last one; after the last step it is held on the destination. The only case
 * that ignores the queue is a drift larger than two tiles from the confirmed
 * tile, which is a lost step and needs a snap.
 */
export function resolveTimeline(
  segments: PathSegment[],
  now: number,
  fallback: Tile,
): TimelineFrame {
  if (segments.length === 0) {
    return { moving: false, pixel: tileToPixel(fallback) };
  }
  const first = segments[0] as PathSegment;
  if (now < first.startsAt) {
    return { moving: false, pixel: tileToPixel(first.from) };
  }
  let active: PathSegment | undefined;
  let finished: PathSegment | undefined;
  for (const segment of segments) {
    if (segment.startsAt > now) {
      break;
    }
    if (now < segment.endsAt) {
      active = segment;
      break;
    }
    finished = segment;
  }
  if (active !== undefined) {
    return { moving: true, pixel: interpolate(active, now), segment: active };
  }
  if (finished !== undefined) {
    return snapIfLost(tileToPixel(finished.to), segments, fallback);
  }
  return { moving: false, pixel: tileToPixel(first.from) };
}

/**
 * The step the clock is inside, for the animation.
 */
export function readTimelineSegment(segments: PathSegment[], now: number): PathSegment | undefined {
  for (const segment of segments) {
    if (segment.startsAt > now) {
      return undefined;
    }
    if (now < segment.endsAt) {
      return segment;
    }
  }
  return undefined;
}

/**
 * The pixel between the two tiles of a step, at the given time.
 *
 * The diagonal moves sixteen pixels on each axis, so the interpolation is per
 * axis and the result is rounded once, to a whole pixel.
 */
export function interpolate(segment: PathSegment, now: number): Pixel {
  const from = tileToPixel(segment.from);
  const to = tileToPixel(segment.to);
  const duration = segment.endsAt - segment.startsAt;
  const progress = duration <= 0 ? 1 : clamp01((now - segment.startsAt) / duration);
  return {
    x: Math.round(from.x + (to.x - from.x) * progress),
    y: Math.round(from.y + (to.y - from.y) * progress),
  };
}

function snapIfLost(pixel: Pixel, segments: PathSegment[], fallback: Tile): TimelineFrame {
  const fallbackPixel = tileToPixel(fallback);
  if (samePixel(pixel, fallbackPixel) || isKnownTile(segments, fallback)) {
    return { moving: false, pixel };
  }
  const distance = Math.max(
    Math.abs(pixel.x - fallbackPixel.x),
    Math.abs(pixel.y - fallbackPixel.y),
  );
  if (distance <= SNAP_DISTANCE_PX) {
    return { moving: false, pixel };
  }
  return { moving: false, pixel: fallbackPixel };
}

function isKnownTile(segments: PathSegment[], tile: Tile): boolean {
  for (const segment of segments) {
    if (sameTile(segment.from, tile) || sameTile(segment.to, tile)) {
      return true;
    }
  }
  return false;
}

function hasSegment(segments: PathSegment[], candidate: PathSegment): boolean {
  for (const segment of segments) {
    if (
      segment.startsAt === candidate.startsAt &&
      segment.endsAt === candidate.endsAt &&
      sameTile(segment.from, candidate.from) &&
      sameTile(segment.to, candidate.to)
    ) {
      return true;
    }
  }
  return false;
}

function compareSegments(left: PathSegment, right: PathSegment): number {
  return left.startsAt - right.startsAt;
}

function sameTile(left: Tile, right: Tile): boolean {
  return left.x === right.x && left.y === right.y;
}

function samePixel(left: Pixel, right: Pixel): boolean {
  return left.x === right.x && left.y === right.y;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
