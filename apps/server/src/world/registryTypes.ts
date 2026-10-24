import type { GameErrorCode } from '@creatures/contracts/game';
import type { Gender } from '@creatures/contracts/trainer';
import type { ActorMedia, Direction, PathSegment, Tile } from '@creatures/contracts/world';

/** Where the trainer enters the world; the caller already checked the map. */
export type ActorStart = {
  facing: Direction;
  x: number;
  y: number;
};

export type ActorProfile = {
  gender: Gender;
  name: string;
  /** The durable owner of the actor row. */
  trainerId: string;
  /** The persisted position, when the caller has one. */
  start?: ActorStart;
};

/** The position a confirmed step leaves behind. */
export type StepConfirmation = {
  actorId: string;
  dir: Direction;
  position: Tile;
  trainerId: string;
};

export type MoveOutcome = {
  code?: GameErrorCode;
  ok: boolean;
  path: PathSegment[];
  reqId: string;
};

export type WorldRegistry = {
  actor(userId: string, at: number): ActorMedia | undefined;
  actors(at: number, exceptId?: string): ActorMedia[];
  advance(userId: string, at: number): ActorMedia | undefined;
  cacheMove(userId: string, reqId: string, outcome: MoveOutcome, at: number): void;
  /** Completes the step in course, so the actor lands on its `to`. */
  completeStep(userId: string, at: number): ActorMedia | undefined;
  join(userId: string, profile: ActorProfile, at: number): ActorMedia;
  leave(userId: string, at: number): boolean;
  nextWorldRev(observerId: string): number;
  now(): number;
  presentIds(): string[];
  readCachedMove(userId: string, reqId: string, at: number): MoveOutcome | undefined;
  setPath(userId: string, path: PathSegment[], at: number): void;
  /** The durable trainer of an actor, when it exists. */
  trainerId(userId: string): string | undefined;
};

export type WorldRegistryOptions = {
  now?: () => number;
  /** Called once per step the clock confirmed, for the write-behind. */
  onStepConfirmed?: (confirmation: StepConfirmation) => void;
};
