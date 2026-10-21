import type { HuntAction, HuntEndReason } from '@creatures/contracts/huntSession';

/**
 * The rules that close a hunt and the way the clock of a window stops.
 *
 * A hunt closes for five reasons, and three of them are moments: the stamina
 * of the trainer ends, the offline session of the account ends, and the player
 * switches the trainer. The other two are not moments, and they are checked
 * inside the advance of the window.
 */

/**
 * A rule that closes the hunt.
 */
export type HuntClosing = {
  /** The moment the rule closes the hunt. */
  at: number;
  /** Why the rule closes the hunt. */
  reason: HuntEndReason;
};

/**
 * Why the clock of a window stopped.
 */
export type AdvanceStop = {
  /** The moment the clock stopped. */
  at: number;
  /** The rule that closed the hunt, when a rule closed it. */
  closing: HuntClosing | null;
  /** What stopped the clock. */
  kind: 'rule' | 'switch' | 'action' | 'until';
};

/**
 * The rules that close the hunt, with the moment each of them closes it.
 */
export function readClosings(
  ruleReason: HuntEndReason,
  ruleEndsAt: number,
  trainerSwitchedAt: number | null,
): HuntClosing[] {
  const closings: HuntClosing[] = [{ at: ruleEndsAt, reason: ruleReason }];
  if (trainerSwitchedAt !== null) {
    closings.push({ at: trainerSwitchedAt, reason: 'trainer_switched' });
  }
  return closings;
}

/**
 * The closing that already passed, when the session was not closed in time.
 *
 * It happens when the session was left open past the moment it should have
 * been closed. The hunt is closed now, at the cursor, with the reason of the
 * rule that passed.
 */
export function readOverdueClosing(closings: HuntClosing[], cursor: number): HuntClosing | null {
  let overdue: HuntClosing | null = null;
  for (const closing of closings) {
    if (closing.at > cursor) {
      continue;
    }
    if (overdue === null || closing.at < overdue.at) {
      overdue = closing;
    }
  }
  return overdue;
}

/**
 * The moment the clock of the window stops, and what stopped it.
 *
 * The rules win a tie: the end of the hunt is not the choice of the player.
 */
export function readStop(
  closings: HuntClosing[],
  cursor: number,
  untilTs: number,
  action: HuntAction | undefined,
): AdvanceStop {
  let closing: HuntClosing | null = null;
  for (const candidate of closings) {
    if (candidate.at <= cursor) {
      continue;
    }
    if (closing === null || candidate.at < closing.at) {
      closing = candidate;
    }
  }

  if (closing !== null && closing.at <= untilTs) {
    const kind = closing.reason === 'trainer_switched' ? 'switch' : 'rule';
    return { at: closing.at, closing, kind };
  }

  if (action !== undefined && action.at > cursor && action.at <= untilTs) {
    return { at: action.at, closing: null, kind: 'action' };
  }

  return { at: untilTs, closing: null, kind: 'until' };
}

/**
 * The actions of the player that happened in the window, in the order they
 * happened.
 *
 * The actions that happened before the window are already part of the state
 * that was persisted, and the ones after it belong to the next window.
 */
export function readPendingActions(
  actions: HuntAction[],
  windowStart: number,
  untilTs: number,
): HuntAction[] {
  return actions
    .filter(function isInWindow(action: HuntAction): boolean {
      return action.at > windowStart && action.at <= untilTs;
    })
    .toSorted(function byMoment(first: HuntAction, second: HuntAction): number {
      return first.at - second.at;
    });
}
