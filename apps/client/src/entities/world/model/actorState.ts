import type { Direction, PathSegment } from '@creatures/contracts/world';

/**
 * The four poses the sprite atlas has.
 *
 * The eight directions map to four poses: the left column of the atlas is the
 * mirror of the right one, so there is no runtime flip.
 */
export type TrainerPose = 'up' | 'down' | 'left' | 'right';

/**
 * Whether the actor is standing still or moving.
 */
export type ActorState = 'idle' | 'walking';

/**
 * The pose and frame an actor should show at a given time.
 */
export type ActorAnimation = {
  frame: number;
  pose: TrainerPose;
  state: ActorState;
};

export const IDLE_FRAME_COUNT = 2;
export const WALK_FRAME_COUNT = 4;

/**
 * One loop of the idle animation, in milliseconds.
 */
export const IDLE_LOOP_MS = 800;

const IDLE_FRAME_MS = IDLE_LOOP_MS / IDLE_FRAME_COUNT;

const POSE_BY_DIRECTION: Record<Direction, TrainerPose> = {
  down: 'down',
  downLeft: 'down',
  downRight: 'down',
  left: 'left',
  right: 'right',
  up: 'up',
  upLeft: 'up',
  upRight: 'up',
};

/**
 * The pose that faces a direction.
 */
export function directionToPose(direction: Direction): TrainerPose {
  return POSE_BY_DIRECTION[direction];
}

/**
 * The animation an actor should show, from its facing and its step in course.
 *
 * Idle cycles two frames on the clock; walking spreads four frames over the
 * step, so the legs match the distance instead of playing at a fixed rate. The
 * moment before a step starts and after it ends is idle, facing the direction
 * it just walked.
 */
export function computeActorAnimation(
  direction: Direction,
  segment: PathSegment | undefined,
  now: number,
): ActorAnimation {
  const pose = directionToPose(direction);
  if (segment === undefined || now < segment.startsAt || now >= segment.endsAt) {
    return { frame: computeIdleFrame(now), pose, state: 'idle' };
  }
  const duration = segment.endsAt - segment.startsAt;
  const progress = duration <= 0 ? 1 : clamp01((now - segment.startsAt) / duration);
  const frame = Math.min(WALK_FRAME_COUNT - 1, Math.floor(progress * WALK_FRAME_COUNT));
  return { frame, pose, state: 'walking' };
}

function computeIdleFrame(now: number): number {
  const index = Math.floor(now / IDLE_FRAME_MS) % IDLE_FRAME_COUNT;
  return index < 0 ? index + IDLE_FRAME_COUNT : index;
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
