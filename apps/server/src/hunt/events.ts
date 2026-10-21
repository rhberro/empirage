import type { HuntAction, HuntEndReason } from '@creatures/contracts/huntSession';

/**
 * The facts of a window of the simulation.
 *
 * The events are what the server publishes to the player. They are a list of
 * facts, not a snapshot: the client applies them in the order they come.
 */
export type HuntEvent =
  | {
      /** The minutes of stamina the window consumed. */
      minutes: number;
      /** The moment the consumption happened. */
      at: number;
      /** The fact is the stamina consumed by the hunt. */
      type: 'stamina_spent';
    }
  | {
      /** The action the player took. */
      action: HuntAction;
      /** The moment the action happened. */
      at: number;
      /** The fact is an action of the player. */
      type: 'action_applied';
    }
  | {
      /** The moment the hunt ended. */
      at: number;
      /** Why the hunt ended. */
      endReason: HuntEndReason;
      /** The fact is the end of the hunt. */
      type: 'hunt_ended';
    };

/**
 * The facts of the end of a window: the stamina it consumed and the end of
 * the hunt, when it ended.
 */
export function readClosingEvents(
  events: HuntEvent[],
  cursor: number,
  windowStart: number,
  endReason: HuntEndReason | null,
  endedAt: number | null,
): HuntEvent[] {
  const elapsedMinutes = (cursor - windowStart) / 60_000;
  if (elapsedMinutes > 0) {
    events.push({ at: cursor, minutes: elapsedMinutes, type: 'stamina_spent' });
  }
  if (endReason !== null && endedAt !== null) {
    events.push({ at: endedAt, endReason, type: 'hunt_ended' });
  }
  return events;
}
