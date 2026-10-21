import type { HuntAction, HuntEndReason, HuntSession } from '@creatures/contracts/huntSession';

import type { HuntClosing } from '~/hunt/closings';
import { readClosings, readOverdueClosing, readPendingActions, readStop } from '~/hunt/closings';
import type { HuntEvent } from '~/hunt/events';
import { readClosingEvents } from '~/hunt/events';
import type { HuntAdvanceRules } from '~/hunt/rules';
import { readHuntRules, resolveHuntRuleEnd } from '~/hunt/rules';

/**
 * The advance of the simulation of a hunt.
 *
 * The advance is a pure function: the same session, the same instant and the
 * same rules always give the same result. It is the only place where the
 * simulation moves forward, and it is used in the three moments that need it
 * -- online, in the catch-up of an offline hunt and in the checkpoint.
 *
 * There is no clock inside this module and no call to `Math.random`: the time
 * comes from the argument and the randomness comes from the state of the
 * session. A function that read the wall clock would make the catch-up of an
 * offline hunt depend on the day it was replayed.
 */

/**
 * The result of an advance.
 */
export type HuntAdvanceResult = {
  /** The facts that happened in the window. */
  events: HuntEvent[];
  /** The session after the advance. */
  session: HuntSession;
};

/**
 * The plan of a window: the rules that close the hunt and the actions that
 * happened inside it.
 */
type AdvancePlan = {
  /** The rules that close the hunt. */
  closings: HuntClosing[];
  /** The actions of the player that happened in the window. */
  pending: HuntAction[];
  /** The moment the window starts. */
  windowStart: number;
  /** The moment the window ends. */
  untilTs: number;
};

/**
 * What the advance of a window did.
 */
type AdvanceOutcome = {
  /** The moment the clock of the hunt stopped. */
  cursor: number;
  /** Why the hunt ended, when it ended. */
  endReason: HuntEndReason | null;
  /** The moment the hunt ended, when it ended. */
  endedAt: number | null;
  /** The facts that happened in the window. */
  events: HuntEvent[];
};

/**
 * Moves the simulation of a hunt forward, until the given moment.
 *
 * The actions of the player that happened in the window are replayed in the
 * order they happened: the clock runs until the moment of the action, the
 * action is applied, and the clock runs again. The hunt closes at the first
 * rule that reaches it, and the rules win a tie: the end of the hunt is not
 * the choice of the player.
 *
 * The stamina of the trainer when the hunt began comes from the session and
 * not from the context: it is captured once, when the hunt begins, because the
 * instant the hunt ends by stamina depends on it. Deriving it from the trainer
 * would tie the end of the hunt to a rule about how the stamina is persisted,
 * and that rule is not guaranteed anywhere.
 */
export function advance(
  session: HuntSession,
  untilTs: number,
  rules: HuntAdvanceRules,
): HuntAdvanceResult {
  if (session.status !== 'active' || untilTs <= session.lastSimulatedAt) {
    return { events: [], session };
  }
  const plan = buildPlan(session, untilTs, rules);
  const outcome = runPlan(plan, rules);
  return {
    events: outcome.events,
    session: buildSession(session, outcome),
  };
}

/**
 * The rules that close the hunt and the actions of the window.
 */
function buildPlan(session: HuntSession, untilTs: number, rules: HuntAdvanceRules): AdvancePlan {
  const accountRules = readHuntRules(rules.accountType);
  const ruleEnd = resolveHuntRuleEnd({
    offlineSessionMinutes: accountRules.offlineSessionMinutes,
    staminaAtStart: session.staminaAtStart,
    startedAt: session.startedAt,
  });
  return {
    closings: readClosings(ruleEnd.reason, ruleEnd.endsAt, rules.trainerSwitchedAt),
    pending: readPendingActions(session.actions, session.lastSimulatedAt, untilTs),
    untilTs,
    windowStart: session.lastSimulatedAt,
  };
}

/**
 * Runs the clock of the window, replaying the actions of the player.
 */
function runPlan(plan: AdvancePlan, rules: HuntAdvanceRules): AdvanceOutcome {
  const events: HuntEvent[] = [];
  let cursor = plan.windowStart;
  let endReason: HuntEndReason | null = null;
  let endedAt: number | null = null;

  const overdue = readOverdueClosing(plan.closings, cursor);
  if (overdue !== null) {
    endReason = overdue.reason;
    endedAt = cursor;
  } else if (!rules.canKeepFighting(cursor)) {
    endReason = 'no_viable_creature';
    endedAt = cursor;
  }

  let index = 0;
  while (endReason === null) {
    const action = plan.pending[index];
    const stop = readStop(plan.closings, cursor, plan.untilTs, action);
    cursor = stop.at;

    if (stop.closing !== null) {
      endReason = stop.closing.reason;
      endedAt = stop.at;
      break;
    }

    if (stop.kind === 'action' && action !== undefined) {
      index += 1;
      const reason = readActionOutcome(action, rules, events);
      if (reason !== null) {
        endReason = reason;
        endedAt = action.at;
        break;
      }
      continue;
    }

    break;
  }

  return {
    cursor,
    endReason,
    endedAt,
    events: readClosingEvents(events, cursor, plan.windowStart, endReason, endedAt),
  };
}

/**
 * The reason the hunt closed when an action of the player was applied.
 *
 * The finalization of the hunt is the only action that closes it. The other
 * actions are reported and the hunt goes on.
 */
function readActionOutcome(
  action: HuntAction,
  rules: HuntAdvanceRules,
  events: HuntEvent[],
): HuntEndReason | null {
  if (action.type === 'finalize_hunt') {
    return 'player_finalized';
  }
  events.push({ action, at: action.at, type: 'action_applied' });
  if (!rules.canKeepFighting(action.at)) {
    return 'no_viable_creature';
  }
  return null;
}

/**
 * The session after the advance of the window.
 */
function buildSession(session: HuntSession, outcome: AdvanceOutcome): HuntSession {
  return {
    ...session,
    endReason: outcome.endReason,
    endedAt: outcome.endedAt,
    lastSimulatedAt: outcome.cursor,
    staminaSpentMinutes: readStaminaSpent(session, outcome.cursor),
    status: outcome.endReason === null ? 'active' : 'finished',
  };
}

/**
 * The minutes of stamina the hunt consumed until now.
 *
 * The stamina of a trainer does not recover while the trainer hunts, so what
 * the hunt consumed is the time it lasted. The value never goes down: a
 * session that was already advanced keeps what it had.
 */
function readStaminaSpent(session: HuntSession, cursor: number): number {
  const elapsed = Math.floor((cursor - session.startedAt) / 60_000);
  return Math.max(session.staminaSpentMinutes, elapsed);
}
