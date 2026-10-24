/**
 * How long the outgoing creature takes to shrink into the ball.
 */
export const SWAP_ABSORB_MS = 320;

/**
 * How long the ball waits before the incoming creature comes out.
 */
export const SWAP_HOLD_MS = 2000;

/**
 * How long the incoming creature takes to grow out of the ball.
 */
export const SWAP_RELEASE_MS = 320;

export const SWAP_TOTAL_MS = SWAP_HOLD_MS + SWAP_RELEASE_MS;

/**
 * How long the capture ball takes to fly from the trainer to the corpse.
 */
export const CAPTURE_FLY_MS = 600;

/**
 * How long the success of a capture takes to absorb the corpse into the ball.
 */
export const CAPTURE_ABSORB_MS = 340;

export const CAPTURE_TOTAL_MS = CAPTURE_FLY_MS + CAPTURE_ABSORB_MS;

/**
 * How long a creature stays gold after a level-up.
 */
export const LEVEL_UP_FLASH_MS = 900;

/**
 * How long the level-up label stays above the creature.
 */
export const LEVEL_UP_TEXT_MS = 1200;

export type SwapVisual = {
  ballAlpha: number;
  /** Whether the ball is already over the incoming creature. */
  ballAtIncoming: boolean;
  ballScale: number;
  incomingAlpha: number;
  incomingScale: number;
  outgoingAlpha: number;
  outgoingScale: number;
};

/**
 * The scale and alpha of both creatures of a swap at an instant.
 *
 * The outgoing one shrinks into the ball, the ball waits and then the incoming
 * one grows out of it. The renderer only applies the numbers: the sequence
 * lives here, where it can be read without a canvas.
 */
export function computeSwapVisual(elapsed: number): SwapVisual {
  const time = Math.max(0, elapsed);
  if (time < SWAP_ABSORB_MS) {
    const progress = time / SWAP_ABSORB_MS;
    return {
      ballAlpha: 1,
      ballAtIncoming: false,
      ballScale: 0.35 + 0.65 * progress,
      incomingAlpha: 0,
      incomingScale: 0,
      outgoingAlpha: 1 - progress,
      outgoingScale: 1 - progress,
    };
  }
  if (time < SWAP_HOLD_MS) {
    return {
      ballAlpha: 1,
      ballAtIncoming: false,
      ballScale: 1,
      incomingAlpha: 0,
      incomingScale: 0,
      outgoingAlpha: 0,
      outgoingScale: 0,
    };
  }
  const progress = clamp01((time - SWAP_HOLD_MS) / SWAP_RELEASE_MS);
  return {
    ballAlpha: 1 - progress,
    ballAtIncoming: true,
    ballScale: 1 - 0.6 * progress,
    incomingAlpha: progress,
    incomingScale: progress,
    outgoingAlpha: 0,
    outgoingScale: 0,
  };
}

export function isSwapFinished(elapsed: number): boolean {
  return elapsed >= SWAP_TOTAL_MS;
}

export type CaptureVisual = {
  absorbing: boolean;
  ballAlpha: number;
  /** How far the ball is between the trainer and the corpse, from 0 to 1. */
  ballProgress: number;
  ballScale: number;
  targetAlpha: number;
  targetScale: number;
  visible: boolean;
};

/**
 * The flight of the capture ball and the absorption of a captured corpse.
 *
 * A failed attempt only flies: the corpse stays where it is until the server
 * removes it. A success shrinks the corpse into the ball after the flight.
 */
export function computeCaptureVisual(elapsed: number, success: boolean): CaptureVisual {
  if (elapsed < CAPTURE_FLY_MS) {
    const progress = clamp01(elapsed / CAPTURE_FLY_MS);
    return {
      absorbing: false,
      ballAlpha: 1,
      ballProgress: progress,
      ballScale: 1,
      targetAlpha: 1,
      targetScale: 1,
      visible: true,
    };
  }
  if (!success) {
    return {
      absorbing: false,
      ballAlpha: 0,
      ballProgress: 1,
      ballScale: 1,
      targetAlpha: 1,
      targetScale: 1,
      visible: false,
    };
  }
  const progress = clamp01((elapsed - CAPTURE_FLY_MS) / CAPTURE_ABSORB_MS);
  return {
    absorbing: true,
    ballAlpha: 1 - progress,
    ballProgress: 1,
    ballScale: 1 - 0.3 * progress,
    targetAlpha: 1 - progress,
    targetScale: 1 - progress,
    visible: elapsed < CAPTURE_TOTAL_MS,
  };
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

/** How long the corpse waits before the trainer throws the ball. */
export const CAPTURE_THROW_DELAY_MS = 1000;

/** How long the ball flies, from the throw to the green/red result. */
export const CAPTURE_FLIGHT_MS = 2000;

/** How long the green/red result stays on the ball. */
export const CAPTURE_RESULT_MS = 800;

export type CaptureBallVisual = {
  /** How far the ball is between the trainer and the corpse, 0 to 1. */
  progress: number;
  /** Whether the result (green/red) is showing. */
  result: boolean;
  visible: boolean;
};

/**
 * The flight of the capture ball, anchored on the death of the wild.
 *
 * The corpse waits a beat, the trainer throws the ball, it flies to the body
 * and then it shows the result: green on a capture, red otherwise. The result
 * color is chosen by the caller, which knows the outcome.
 */
export function computeCaptureBallVisual(elapsedSinceDeath: number): CaptureBallVisual {
  const time = Math.max(0, elapsedSinceDeath);
  const throwAt = CAPTURE_THROW_DELAY_MS;
  const resultAt = throwAt + CAPTURE_FLIGHT_MS;
  if (time < throwAt) {
    return { progress: 0, result: false, visible: false };
  }
  if (time < resultAt) {
    return {
      progress: clamp01((time - throwAt) / CAPTURE_FLIGHT_MS),
      result: false,
      visible: true,
    };
  }
  if (time < resultAt + CAPTURE_RESULT_MS) {
    return { progress: 1, result: true, visible: true };
  }
  return { progress: 1, result: false, visible: false };
}
