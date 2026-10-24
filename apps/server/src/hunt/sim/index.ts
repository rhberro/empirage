export { findNearestWild, findPlayerTarget, thinkPlayer } from '~/hunt/sim/ai';
export { TARGET_ACQUIRE_RANGE, TARGET_LOST_RANGE } from '~/hunt/sim/ai';
export { consumeConsumables, useConsumables } from '~/hunt/sim/consumables';
export {
  ABILITY_INTERVAL_MS,
  applyDamage,
  castAbility,
  effectiveRange,
  MELEE_ABILITY,
  resolveProjectiles,
  resolveWaves,
} from '~/hunt/sim/combat';
export { createHuntState } from '~/hunt/sim/create';
export type { CreateHuntStateInput } from '~/hunt/sim/create';
export { resolveCaptures, resolveDeaths, respawnWilds } from '~/hunt/sim/deaths';
export {
  areaTiles,
  chebyshev,
  directionBetween,
  neighbors8,
  stepDuration,
  tileKey,
  waveTiles,
} from '~/hunt/sim/geometry';
export {
  advanceTrainer,
  finishStep,
  MAX_TRAINER_TRAIL,
  nextStepToward,
  pushTrail,
  startStep,
  stepToward,
} from '~/hunt/sim/movement';
export type { SimMover } from '~/hunt/sim/movement';
export { createFlowField, readFlowField, readFlowStep } from '~/hunt/sim/flow';
export type { FlowField } from '~/hunt/sim/flow';
export { findFreeTileNear, isTileBlocked, TRAINER_ACTOR_ID } from '~/hunt/sim/occupancy';
export { advanceUntil, finalizeHunt, nextInstant, swapActive } from '~/hunt/sim/simulate';
export {
  computeAbilityDamage,
  computeMeleeDamage,
  createCreatureFromSpecies,
  effectivenessFor,
} from '~/hunt/sim/stats';
export type { CreateCreatureInput, SimAttackerLike } from '~/hunt/sim/stats';
export { activeCreature, isAlive, sameTile } from '~/hunt/sim/types';
export type {
  SimAbility,
  SimAttacker,
  SimAttributeSet,
  SimConsumable,
  SimContent,
  SimCreature,
  SimDevice,
  SimDrop,
  SimEvent,
  SimSpecies,
  SimSpeciesAbility,
  SimSpawn,
  SimState,
  SimTeamMember,
  SimTeamMemberInput,
  SimTrainer,
  SimWave,
} from '~/hunt/sim/types';
export {
  thinkTrainer,
  thinkWild,
  WILD_LEASH_RANGE,
  WILD_MELEE_INTERVAL_MS,
} from '~/hunt/sim/wildAi';
export { WILD_DECISION_MS } from '~/hunt/sim/world';
