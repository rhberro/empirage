import { expect, test } from 'bun:test';

import type { PathSegment } from '@creatures/contracts/world';

import {
  createTimeline,
  pushSegment,
  readTimelineSegment,
  resetTimeline,
  resolveTimeline,
} from '~/entities/world/model/actorTimeline';

function buildSegment(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  startsAt: number,
  endsAt: number,
): PathSegment {
  return {
    dir: 'right',
    endsAt,
    from: { x: fromX, y: fromY },
    startsAt,
    to: { x: toX, y: toY },
  };
}

test('an empty timeline stays on the confirmed tile', function emptyTimeline(): void {
  const frame = resolveTimeline([], 500, { x: 7, y: 3 });
  expect(frame).toEqual({ moving: false, pixel: { x: 112, y: 48 } });
});

test('before the first step the actor is on its start', function beforeFirst(): void {
  const segment = buildSegment(1, 1, 2, 1, 100, 400);
  const frame = resolveTimeline([segment], 50, { x: 1, y: 1 });
  expect(frame).toEqual({ moving: false, pixel: { x: 16, y: 16 } });
});

test('a step in course interpolates whole pixels', function midStep(): void {
  const segment = buildSegment(0, 0, 1, 0, 0, 300);
  const frame = resolveTimeline([segment], 150, { x: 0, y: 0 });
  expect(frame.pixel).toEqual({ x: 8, y: 0 });
  expect(frame.moving).toBe(true);
  expect(frame.segment).toBe(segment);
});

test('a diagonal step moves on both axes', function diagonal(): void {
  const segment = { ...buildSegment(0, 0, 1, 1, 0, 424), dir: 'downRight' as const };
  expect(resolveTimeline([segment], 212, { x: 0, y: 0 }).pixel).toEqual({ x: 8, y: 8 });
});

test('a gap between steps holds the end of the last one', function gap(): void {
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 2, 0, 600, 900);
  const frame = resolveTimeline([first, second], 450, { x: 1, y: 0 });
  expect(frame).toEqual({ moving: false, pixel: { x: 16, y: 0 } });
});

test('after the last step the actor is on the destination', function afterLast(): void {
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 2, 0, 300, 600);
  expect(resolveTimeline([first, second], 100_000, { x: 0, y: 0 }).pixel).toEqual({
    x: 32,
    y: 0,
  });
});

test('snaps to the confirmed tile when the queue is far behind it', function snapsLostStep(): void {
  const segment = buildSegment(0, 0, 1, 0, 0, 300);
  const frame = resolveTimeline([segment], 10_000, { x: 5, y: 5 });
  expect(frame.pixel).toEqual({ x: 80, y: 80 });
});

test('does not snap when the confirmed tile is one of the step tiles', function keepsKnownTile(): void {
  const segment = buildSegment(0, 0, 1, 0, 0, 300);
  const frame = resolveTimeline([segment], 10_000, { x: 1, y: 0 });
  expect(frame.pixel).toEqual({ x: 16, y: 0 });
});

test('a repeated segment does not grow the queue', function ignoresDuplicate(): void {
  const timeline = createTimeline();
  const segment = buildSegment(0, 0, 1, 0, 0, 300);
  pushSegment(timeline, segment);
  pushSegment(timeline, { ...segment });
  expect(timeline.segments).toHaveLength(1);
});

test('a next step is kept while the current one is still running', function keepsNext(): void {
  const timeline = createTimeline();
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 2, 0, 300, 600);
  pushSegment(timeline, first);
  pushSegment(timeline, second);
  expect(timeline.segments).toEqual([first, second]);
});

test('a correction replaces the future and keeps the past', function replacesFuture(): void {
  const timeline = createTimeline();
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const corrected = buildSegment(1, 0, 1, 1, 300, 600);
  const future = buildSegment(1, 1, 2, 1, 600, 900);
  pushSegment(timeline, first);
  pushSegment(timeline, future);
  pushSegment(timeline, corrected);
  expect(timeline.segments).toEqual([first, corrected]);
});

test('reset replaces the whole queue', function resetsQueue(): void {
  const timeline = createTimeline();
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 2, 0, 300, 600);
  pushSegment(timeline, first);
  resetTimeline(timeline, second);
  expect(timeline.segments).toEqual([second]);
  resetTimeline(timeline);
  expect(timeline.segments).toEqual([]);
});

test('the segment in course is resolved by the clock', function resolvesSegment(): void {
  const first = buildSegment(0, 0, 1, 0, 0, 300);
  const second = buildSegment(1, 0, 1, 1, 300, 600);
  expect(readTimelineSegment([first, second], 150)).toBe(first);
  expect(readTimelineSegment([first, second], 450)).toBe(second);
  expect(readTimelineSegment([first, second], -1)).toBeUndefined();
  expect(readTimelineSegment([first, second], 700)).toBeUndefined();
});
