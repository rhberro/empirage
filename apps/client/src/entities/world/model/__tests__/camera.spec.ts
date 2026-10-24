import { expect, test } from 'bun:test';

import { computeCamera, smoothCamera } from '~/entities/world/model/camera';

const WORLD = { x: 1536, y: 1024 };
const VIEWPORT = { x: 544, y: 320 };

/**
 * The camera centers the followed point, floored to a whole pixel.
 */
test('the camera centers the followed point', function cameraCenters(): void {
  expect(computeCamera({ x: 300, y: 200 }, VIEWPORT, WORLD)).toEqual({ x: 28, y: 40 });
});

/**
 * Near the top-left corner, the camera stops at the origin instead of showing
 * beyond the map.
 */
test('the camera clamps to the top-left corner', function cameraClampsToOrigin(): void {
  expect(computeCamera({ x: 10, y: 10 }, VIEWPORT, WORLD)).toEqual({ x: 0, y: 0 });
});

/**
 * Near the bottom-right corner, the camera stops at the last visible window.
 */
test('the camera clamps to the bottom-right corner', function cameraClampsToEnd(): void {
  expect(computeCamera({ x: 1536, y: 1024 }, VIEWPORT, WORLD)).toEqual({ x: 992, y: 704 });
});

test('a small camera move covers part of the distance', function cameraSmooths(): void {
  expect(smoothCamera({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 4, y: 0 });
  expect(smoothCamera({ x: 4, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 6, y: 0 });
});

test('a large camera jump snaps', function cameraSnaps(): void {
  expect(smoothCamera({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 100, y: 0 });
});

test('the camera never overshoots the target', function cameraDoesNotOvershoot(): void {
  expect(smoothCamera({ x: 9, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0 });
});

/**
 * A viewport larger than the map keeps the camera at the origin.
 */
test('an oversized viewport keeps the camera at the origin', function oversizedViewport(): void {
  expect(computeCamera({ x: 500, y: 500 }, { x: 2000, y: 2000 }, WORLD)).toEqual({ x: 0, y: 0 });
});

/**
 * The camera never leaves a whole pixel, even with an odd viewport.
 */
test('the camera is always a whole pixel', function cameraIsWholePixel(): void {
  const camera = computeCamera({ x: 333, y: 200 }, { x: 545, y: 321 }, WORLD);
  expect(Number.isInteger(camera.x)).toBe(true);
  expect(Number.isInteger(camera.y)).toBe(true);
});
