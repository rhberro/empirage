/**
 * The pathfinding lives in the shared contracts so the client can predict the
 * first step of a click with the same search the server uses.
 *
 * This module keeps the server-facing import path stable.
 */
export {
  DIAGONAL_STEP_COST,
  findPath,
  MAX_PATH_STEPS,
  ORTHOGONAL_STEP_COST,
} from '@creatures/contracts/path';
export type { PathFailure, PathResult, PathStep } from '@creatures/contracts/path';
export {
  MAP_DIAGONALWALKCOST,
  MAP_NORMALWALKCOST,
  MAX_NODES,
  findPathWithParams,
} from '@creatures/contracts/astar';
export type { FindPathParams } from '@creatures/contracts/astar';
