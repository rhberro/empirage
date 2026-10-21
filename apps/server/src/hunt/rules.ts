import type { HuntAccountType, HuntEndReason } from '@creatures/contracts/huntSession';
import { computeHuntEndsAt, readHuntAccountRules } from '@creatures/contracts/huntSession';

/**
 * The rules of the hunt that are not in the shared contract.
 *
 * The account rules -- the speed of the recovery and the length of the offline
 * session -- and the two formulas of the contract live in the contract, because
 * the client derives the same values from the timestamps it receives. What is
 * here is what only the server needs: the limits of the hunt and the shape of
 * the context the advance of the simulation runs with.
 */

/** The stamina of a trainer is twelve hours, for every trainer. */
export const HUNT_MAX_STAMINA_MINUTES = 720;

/** A hunt only starts with thirty minutes of stamina, or more. */
export const HUNT_MINIMUM_STAMINA_MINUTES = 30;

/**
 * The rules of the account that limit the hunt.
 */
export type HuntRules = {
  /** The minutes of hunt the account is allowed in a row. */
  offlineSessionMinutes: number;
  /** The minutes of stamina recovered per minute of real time. */
  staminaRecoveryPerMinute: number;
};

/**
 * The context the advance of the simulation runs with.
 *
 * The advance is a pure function of the session, of the instant it runs until
 * and of this context. Everything the context carries is a rule of the hunt
 * that the session itself does not hold.
 *
 * The stamina of the trainer when the hunt began is not here: it belongs to
 * the session, because the instant the hunt ends by stamina depends on it.
 */
export type HuntAdvanceRules = {
  /** The kind of the account that owns the hunt. */
  accountType: HuntAccountType;
  /**
   * Whether the team still has a creature able to fight.
   *
   * The rule is a condition and not a moment: the team can run out of
   * creatures in the middle of the hunt, and there is no timestamp for it. The
   * callback is injected because the rule of the combat does not exist yet --
   * what makes a creature apt to fight is decided by the fight, and not by the
   * clock.
   */
  canKeepFighting: (at: number) => boolean;
  /**
   * The moment the player switched the trainer, when it happened.
   *
   * The switch closes the hunt of the trainer that was hunting. It is not an
   * action of the timeline, because it comes from the session of the account
   * and not from the hunt.
   */
  trainerSwitchedAt: number | null;
};

/**
 * The moment a hunt ends by rule, and why.
 */
export type HuntRuleEnd = {
  /** The moment the hunt ends. */
  endsAt: number;
  /** Which of the two limits closed the hunt. */
  reason: Extract<HuntEndReason, 'stamina_depleted' | 'offline_session_expired'>;
};

/**
 * The rules of an account.
 */
export function readHuntRules(accountType: HuntAccountType): HuntRules {
  return readHuntAccountRules(accountType);
}

/**
 * The moment a hunt ends by rule, and which of the two limits closed it.
 *
 * The two limits start at the same moment -- the start of the hunt -- so the
 * one that closes the hunt is the shorter of the two. The stamina wins a tie:
 * it is the limit of the trainer itself, and the rule of the game lists it
 * first.
 */
export function resolveHuntRuleEnd(input: {
  /** The minutes of hunt the account is allowed in a row. */
  offlineSessionMinutes: number;
  /** The stamina of the trainer when the hunt started, in minutes. */
  staminaAtStart: number;
  /** The moment the hunt started. */
  startedAt: number;
}): HuntRuleEnd {
  const endsAt = computeHuntEndsAt({
    offlineSessionMinutes: input.offlineSessionMinutes,
    staminaAtStart: input.staminaAtStart,
    startedAt: input.startedAt,
  });
  const reason =
    input.staminaAtStart <= input.offlineSessionMinutes
      ? 'stamina_depleted'
      : 'offline_session_expired';
  return { endsAt, reason };
}

/**
 * Whether a trainer with the given stamina may begin a hunt.
 */
export function canStartHunt(staminaMinutes: number): boolean {
  return staminaMinutes >= HUNT_MINIMUM_STAMINA_MINUTES;
}

/**
 * The minutes of stamina the trainer has left, in the middle of a hunt.
 *
 * The stamina does not recover while the trainer hunts, so what is left is
 * what the trainer had when the hunt began minus what the hunt consumed.
 */
export function computeRemainingStamina(input: {
  /** The minutes of stamina the trainer had when the hunt started. */
  staminaAtStart: number;
  /** The minutes of stamina the hunt consumed until now. */
  staminaSpentMinutes: number;
}): number {
  return Math.max(0, input.staminaAtStart - input.staminaSpentMinutes);
}
