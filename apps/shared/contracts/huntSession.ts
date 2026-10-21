import type { SkillSlot } from './skill';

/**
 * The session of a hunt.
 *
 * A hunt outlives the connection: it starts when the player enters an area and
 * it ends when one of the rules says so. The session is the durable record of
 * that, and it is what the server resumes when it comes back.
 */
export type HuntSessionStatus = 'active' | 'finished';

/**
 * Why a hunt ended.
 *
 * The rules name three automatic causes and one that comes from the player. The
 * reason is kept so that the session stays readable after it ends: deleting it
 * would lose the loot and the accounting of the offline session.
 */
export type HuntEndReason =
  | 'stamina_depleted'
  | 'offline_session_expired'
  | 'no_viable_creature'
  | 'player_finalized'
  | 'trainer_switched';

/**
 * The kind of account.
 *
 * The account decides the speed of the stamina recovery and the length of the
 * offline session. The stamina itself belongs to the trainer.
 */
export type HuntAccountType = 'free' | 'paid';

/**
 * An action the player took during a hunt.
 *
 * The actions carry the moment they happened, because the catch-up of an
 * offline session has to replay them in the same order they happened.
 */
export type HuntAction =
  | { at: number; creatureId: string; type: 'swap_creature' }
  | { at: number; slot: SkillSlot; type: 'use_ability' }
  | { at: number; slot: SkillSlot; type: 'use_consumable' }
  | { at: number; type: 'finalize_hunt' };

/**
 * The session of a hunt, as it is persisted.
 *
 * The cursor of the simulation lives here: `lastSimulatedAt` says until when the
 * session was simulated, and the random state says how the simulation reached
 * that point. Without the random state, the catch-up would draw again and the
 * player would receive loot that is not the loot they earned.
 */
export type HuntSession = {
  /** The moments of the session, in epoch milliseconds. */
  actions: HuntAction[];
  /** The account that owns the session. */
  accountId: string;
  /** The number of encounters the simulation resolved. */
  encounters: number;
  /** The moment the session ended, or null while it runs. */
  endedAt: number | null;
  /** Why the session ended, or null while it runs. */
  endReason: HuntEndReason | null;
  /** The area being hunted. */
  huntAreaId: string;
  /** The identifier of the session. */
  id: string;
  /** The number of creatures that were defeated. */
  kills: number;
  /** The moment the session was simulated until. */
  lastSimulatedAt: number;
  /** The seed of the random state. */
  rngSeed: number;
  /** How many numbers were drawn from the random state. */
  rngDraws: number;
  /** The minutes of stamina the hunt consumed. */
  staminaSpentMinutes: number;
  /**
   * The stamina of the trainer when the hunt started, in minutes.
   *
   * The value is part of the cursor of the simulation: the instant the hunt ends
   * because the stamina ran out depends on it. Deriving it from the stamina of
   * the trainer would tie the end of the hunt to a rule about how the stamina is
   * persisted, and a change on that rule would silently move the end of every
   * hunt.
   */
  staminaAtStart: number;
  /** The moment the session started. */
  startedAt: number;
  /** Whether the session is still running. */
  status: HuntSessionStatus;
  /** The trainer that is hunting. */
  trainerId: string;
};

/**
 * The rules of the account that limit the hunt.
 */
export type HuntAccountRules = {
  /** The minutes of hunt the account is allowed in a row. */
  offlineSessionMinutes: number;
  /** The minutes of stamina recovered per minute of real time. */
  staminaRecoveryPerMinute: number;
};

/** The offline session of a free account lasts four hours. */
export const FREE_ACCOUNT_OFFLINE_SESSION_MINUTES = 240;

/** The offline session of a paid account lasts eight hours. */
export const PAID_ACCOUNT_OFFLINE_SESSION_MINUTES = 480;

/**
 * The rules of an account.
 *
 * A free account recovers one minute of stamina every two minutes, and a paid
 * account recovers one minute every minute.
 */
export function readHuntAccountRules(accountType: HuntAccountType): HuntAccountRules {
  if (accountType === 'paid') {
    return {
      offlineSessionMinutes: PAID_ACCOUNT_OFFLINE_SESSION_MINUTES,
      staminaRecoveryPerMinute: 1,
    };
  }
  return {
    offlineSessionMinutes: FREE_ACCOUNT_OFFLINE_SESSION_MINUTES,
    staminaRecoveryPerMinute: 0.5,
  };
}

/**
 * The stamina of a trainer at a given moment.
 *
 * The stamina recovers whenever the trainer is not hunting, and the recovery is
 * a function of the time that passed. The value is never pushed as a countdown:
 * the client derives it from the timestamp.
 */
export function computeRecoveredStamina(input: {
  /** The recovery of the account, in minutes of stamina per minute of time. */
  recoveryPerMinute: number;
  /** The cap of the stamina of a trainer. */
  maxStaminaMinutes: number;
  /** The moment the value was measured. */
  measuredAt: number;
  /** The moment the stamina is wanted. */
  now: number;
  /** The stamina that was measured. */
  staminaMinutes: number;
}): number {
  const elapsedMinutes = Math.max(0, input.now - input.measuredAt) / 60_000;
  const recovered = input.staminaMinutes + elapsedMinutes * input.recoveryPerMinute;
  return Math.min(input.maxStaminaMinutes, Math.floor(recovered));
}

/**
 * The moment a hunt ends by rule.
 *
 * Two of the three automatic causes close in a formula: the offline session of
 * the account runs out, or the stamina does. The third one, a team without a
 * creature able to fight, is not a moment and is checked inside the advance of
 * the simulation.
 */
export function computeHuntEndsAt(input: {
  /** The stamina of the trainer when the hunt started. */
  staminaAtStart: number;
  /** The length of the offline session, in minutes. */
  offlineSessionMinutes: number;
  /** The moment the hunt started. */
  startedAt: number;
}): number {
  const offlineLimit = input.startedAt + input.offlineSessionMinutes * 60_000;
  const staminaLimit = input.startedAt + input.staminaAtStart * 60_000;
  return Math.min(offlineLimit, staminaLimit);
}
