import { expect, test } from 'bun:test';

import {
  computeCanvasLayout,
  computeWorldScale,
  MIN_WORLD_SCALE,
  VIEWPORT_H,
  VIEWPORT_W,
} from '~/entities/world/model/scale';

/**
 * The reference window is zoomed one to one: the canvas and the container match.
 */
test('the reference window zooms to one', function referenceIsOne(): void {
  expect(computeWorldScale(VIEWPORT_W, VIEWPORT_H)).toBe(1);
});

/**
 * A 1080p screen covers the window four times: the zoom is the integer ceiling
 * of the larger axis, never a fraction.
 */
test('a 1080p screen zooms to four', function fullHdZoomsToFour(): void {
  expect(computeWorldScale(1920, 1080)).toBe(4);
});

/**
 * A window that is exactly doubled zooms to two.
 */
test('a doubled window zooms to two', function doubledWindowZoomsToTwo(): void {
  expect(computeWorldScale(VIEWPORT_W * 2, VIEWPORT_H * 2)).toBe(2);
});

/**
 * A screen smaller than the window stays at the minimum instead of shrinking
 * the pixel art: it crops.
 */
test('a small screen never zooms below the minimum', function smallScreenKeepsMinimum(): void {
  expect(computeWorldScale(320, 240)).toBe(MIN_WORLD_SCALE);
  expect(computeWorldScale(400, 300)).toBe(MIN_WORLD_SCALE);
});

/**
 * A container with no usable space falls back to the minimum.
 */
test('an empty container falls back to the minimum', function emptyContainerFallsBack(): void {
  expect(computeWorldScale(0, 0)).toBe(MIN_WORLD_SCALE);
  expect(computeWorldScale(-1, 100)).toBe(MIN_WORLD_SCALE);
});

/**
 * The cover rounds up: a 1280×600 container needs zoom three because the width
 * passes two windows, so the canvas overflows both axes, centered.
 */
test('a 1280 by 600 container covers at zoom three', function mediumContainerCovers(): void {
  expect(computeCanvasLayout(1280, 600)).toEqual({
    canvasHeight: 960,
    canvasWidth: 1632,
    offsetX: -176,
    offsetY: -180,
    zoom: 3,
  });
});

/**
 * A container just past two windows on the height still covers at three: the
 * excess is cropped, never shown as a bar.
 */
test('a 1600 by 833 container covers at zoom three', function wideShortContainerCovers(): void {
  expect(computeCanvasLayout(1600, 833)).toEqual({
    canvasHeight: 960,
    canvasWidth: 1632,
    offsetX: -16,
    offsetY: -64,
    zoom: 3,
  });
});

/**
 * 1080p covers at zoom four, cropping the overflow on both axes.
 */
test('a 1080p canvas covers at zoom four', function fullHdCanvasCovers(): void {
  expect(computeCanvasLayout(1920, 1080)).toEqual({
    canvasHeight: 1280,
    canvasWidth: 2176,
    offsetX: -128,
    offsetY: -100,
    zoom: 4,
  });
});

/**
 * A container smaller than the window crops at zoom one: the offset turns
 * negative and the canvas spills out of the container, centered on the middle.
 */
test('a smaller container crops at zoom one', function smallerContainerCrops(): void {
  expect(computeCanvasLayout(400, 300)).toEqual({
    canvasHeight: VIEWPORT_H,
    canvasWidth: VIEWPORT_W,
    offsetX: -72,
    offsetY: -10,
    zoom: 1,
  });
});

/**
 * An exact multiple of the window has no crop on either axis.
 */
test('an exact fit has no crop', function exactFitHasNoCrop(): void {
  expect(computeCanvasLayout(VIEWPORT_W * 2, VIEWPORT_H * 2)).toEqual({
    canvasHeight: VIEWPORT_H * 2,
    canvasWidth: VIEWPORT_W * 2,
    offsetX: 0,
    offsetY: 0,
    zoom: 2,
  });
});

/**
 * The cover never shows a bar: on every axis the canvas is at least as large as
 * the container, so the overflow is always a crop, never a letterbox.
 */
test('the canvas always covers the container', function canvasAlwaysCovers(): void {
  const sizes = [
    [320, 240],
    [400, 300],
    [544, 320],
    [545, 321],
    [1280, 600],
    [1600, 833],
    [1920, 1080],
    [2560, 1440],
  ];
  for (const [width, height] of sizes) {
    const layout = computeCanvasLayout(width, height);
    expect(layout.canvasWidth).toBeGreaterThanOrEqual(width);
    expect(layout.canvasHeight).toBeGreaterThanOrEqual(height);
  }
});
