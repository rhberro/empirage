import { expect, test } from 'bun:test';

import { computeScale } from '~/app/scale/scale';

const MIN = 0.5;
const MAX = 1.2;
const REFERENCE = 1280;
const REFERENCE_HEIGHT = 720;

function scale(width: number, height: number): number {
  return computeScale({
    max: MAX,
    min: MIN,
    reference: REFERENCE,
    referenceHeight: REFERENCE_HEIGHT,
    viewportHeight: height,
    viewportWidth: width,
  });
}

function theReferenceScreenHasNoScale(): void {
  expect(scale(1280, 720)).toBe(1);
}

function theScaleFollowsTheWidth(): void {
  expect(scale(1920, 1080)).toBe(MAX);
  expect(scale(1600, 900)).toBe(MAX);
}

function theScaleFollowsTheHeight(): void {
  expect(scale(1920, 500)).toBeCloseTo(500 / 720);
}

function theScaleNeverLeavesTheLimits(): void {
  expect(scale(390, 844)).toBe(MIN);
  expect(scale(3840, 2160)).toBe(MAX);
}

test('a tela de referencia nao tem escala', theReferenceScreenHasNoScale);
test('a escala segue a largura', theScaleFollowsTheWidth);
test('a escala segue a altura', theScaleFollowsTheHeight);
test('a escala nunca sai dos limites', theScaleNeverLeavesTheLimits);
