/**
 * The public API of the hunt.
 *
 * The hunt is the domain of the server: the session that outlives the
 * connection, the deterministic advance of its simulation and the rules of the
 * account and of the trainer that limit it. The routes and the WebSocket lane
 * consume this module and never touch the state of a hunt directly.
 */

export { advance } from '~/hunt/clock';
export type { HuntAdvanceResult } from '~/hunt/clock';

export type { HuntEvent } from '~/hunt/events';

export { createHuntSeed, drawInt, drawUnit, drawWeighted } from '~/hunt/rng';
export type { HuntRandomDraw, HuntRandomState, WeightedEntry } from '~/hunt/rng';

export {
  canStartHunt,
  computeRemainingStamina,
  HUNT_MAX_STAMINA_MINUTES,
  HUNT_MINIMUM_STAMINA_MINUTES,
  readHuntRules,
  resolveHuntRuleEnd,
} from '~/hunt/rules';
export type { HuntAdvanceRules, HuntRuleEnd, HuntRules } from '~/hunt/rules';

export {
  appendHuntAction,
  finishHuntSession,
  listActiveHuntSessionsBehind,
  readActiveHuntSession,
  readHuntSession,
  saveHuntCursor,
  startHuntSession,
} from '~/hunt/session';
export type { StartHuntSessionInput } from '~/hunt/session';
