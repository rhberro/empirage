import type { Direction, PathSegment } from '@creatures/contracts/world';

import {
  directionToPose,
  IDLE_FRAME_COUNT,
  IDLE_LOOP_MS,
  type TrainerPose,
} from '~/entities/world/model/actorState';

/**
 * The four poses a creature atlas has, shared with the trainer.
 */
export type CreaturePose = TrainerPose;

/**
 * What a creature is doing: standing, walking or striking.
 */
export type CreatureMotion = 'idle' | 'walk' | 'attack';

export const WALK_FRAME_COUNT = 4;
export const ATTACK_FRAME_COUNT = 2;

/**
 * How long the strike animation plays after an `ability_cast`.
 */
export const ATTACK_MS = 350;

export type CreatureAnimation = {
  frame: number;
  pose: CreaturePose;
  state: CreatureMotion;
};

export type CreatureAnimationInput = {
  /** The timestamp of the latest cast of the actor, or null when idle. */
  castAt: number | null;
  dir: Direction;
  now: number;
  segment?: PathSegment;
};

/**
 * The pose and frame a creature should show at a time.
 *
 * The attack takes over while it lasts; a step in course spreads four frames
 * over its duration; otherwise the creature breathes in the two idle frames.
 */
export function computeCreatureAnimation(input: CreatureAnimationInput): CreatureAnimation {
  const pose = directionToPose(input.dir);
  if (input.castAt !== null && input.now >= input.castAt && input.now - input.castAt < ATTACK_MS) {
    return { frame: computeAttackFrame(input.now - input.castAt), pose, state: 'attack' };
  }
  const segment = input.segment;
  if (segment !== undefined && input.now >= segment.startsAt && input.now < segment.endsAt) {
    return { frame: computeWalkFrame(segment, input.now), pose, state: 'walk' };
  }
  return { frame: computeIdleFrame(input.now), pose, state: 'idle' };
}

function computeAttackFrame(elapsed: number): number {
  const perFrame = ATTACK_MS / ATTACK_FRAME_COUNT;
  const index = Math.floor(elapsed / perFrame);
  return Math.min(ATTACK_FRAME_COUNT - 1, Math.max(0, index));
}

function computeWalkFrame(segment: PathSegment, now: number): number {
  const duration = segment.endsAt - segment.startsAt;
  const progress = duration <= 0 ? 1 : clamp01((now - segment.startsAt) / duration);
  return Math.min(WALK_FRAME_COUNT - 1, Math.floor(progress * WALK_FRAME_COUNT));
}

function computeIdleFrame(now: number): number {
  const frameMs = IDLE_LOOP_MS / IDLE_FRAME_COUNT;
  const index = Math.floor(now / frameMs) % IDLE_FRAME_COUNT;
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
