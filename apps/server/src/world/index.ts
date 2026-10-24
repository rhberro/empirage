/**
 * The public API of the world.
 *
 * The world is the grid the city lives on: the committed map, the path the
 * server plans, the in-memory state of the actors and the light channel that
 * carries their movement. The WebSocket lane consumes this module and never
 * touches the state of an actor directly.
 */

export { createWorldBroadcaster } from '~/world/broadcaster';
export type { WorldBroadcaster } from '~/world/broadcaster';

export { createWorldChannel } from '~/world/channel';
export type { WorldChannel } from '~/world/channel';

export { readMoveTarget } from '~/world/command';

export { CITY_MAP } from '~/world/map';

export { findPath, MAX_PATH_STEPS } from '~/world/path';
export type { PathFailure, PathResult, PathStep } from '~/world/path';

export { createWorldRegistry, MOVE_CACHE_TTL_MS } from '~/world/registry';
export type {
  ActorProfile,
  ActorStart,
  MoveOutcome,
  StepConfirmation,
  WorldRegistry,
  WorldRegistryOptions,
} from '~/world/registry';

export {
  createWorldRuler,
  DIAGONAL_STEP_MS,
  ORTHOGONAL_STEP_MS,
  stepDurationMs,
} from '~/world/ruler';
export type { MoveAnswer, WorldRuler } from '~/world/ruler';
