import { expect, test } from 'bun:test';

import {
  CAPTURE_FLY_MS,
  computeCaptureVisual,
  computeSwapVisual,
  isSwapFinished,
  SWAP_ABSORB_MS,
  SWAP_HOLD_MS,
  SWAP_RELEASE_MS,
  SWAP_TOTAL_MS,
} from '~/entities/hunt/model/huntAnimation';

test('the swap starts with the outgoing creature and no incoming one', function absorbs(): void {
  const start = computeSwapVisual(0);
  expect(start.outgoingScale).toBe(1);
  expect(start.outgoingAlpha).toBe(1);
  expect(start.incomingScale).toBe(0);
  expect(start.incomingAlpha).toBe(0);
  expect(start.ballAlpha).toBe(1);
});

test('the swap keeps both creatures hidden while the ball waits', function waits(): void {
  const waiting = computeSwapVisual(SWAP_ABSORB_MS + (SWAP_HOLD_MS - SWAP_ABSORB_MS) / 2);
  expect(waiting.outgoingAlpha).toBe(0);
  expect(waiting.incomingAlpha).toBe(0);
  expect(waiting.ballScale).toBe(1);
  expect(waiting.ballAtIncoming).toBe(false);
});

test('the swap ends with the incoming creature out of the ball', function releases(): void {
  const released = computeSwapVisual(SWAP_TOTAL_MS);
  expect(released.incomingScale).toBe(1);
  expect(released.incomingAlpha).toBe(1);
  expect(released.ballAlpha).toBe(0);
  expect(released.ballAtIncoming).toBe(true);
  expect(isSwapFinished(SWAP_RELEASE_MS)).toBe(false);
  expect(isSwapFinished(SWAP_TOTAL_MS)).toBe(true);
});

test('the capture ball flies from the trainer to the corpse', function flies(): void {
  const start = computeCaptureVisual(0, true);
  expect(start.ballProgress).toBe(0);
  expect(start.targetScale).toBe(1);
  const half = computeCaptureVisual(CAPTURE_FLY_MS / 2, true);
  expect(half.ballProgress).toBeCloseTo(0.5);
});

test('a successful capture shrinks the corpse after the flight', function absorbsCorpse(): void {
  const absorbing = computeCaptureVisual(CAPTURE_FLY_MS + 100, true);
  expect(absorbing.absorbing).toBe(true);
  expect(absorbing.targetScale).toBeLessThan(1);
  expect(absorbing.targetAlpha).toBeLessThan(1);
});

test('a failed capture leaves the corpse untouched', function failsCapture(): void {
  const failed = computeCaptureVisual(CAPTURE_FLY_MS + 100, false);
  expect(failed.visible).toBe(false);
  expect(failed.targetScale).toBe(1);
});
