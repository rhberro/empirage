import type { PlayerState } from '@creatures/contracts/player';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';

import { loadPlayerState } from '~/state/playerState';
import type { RevCounter } from '~/state/rev';
import type { ConnectionRegistry } from '~/ws/connections';
import { buildStateSnapshot, sendMessage } from '~/ws/protocol';

/**
 * Pushes the new state of a player to the channel of the account.
 *
 * The push is the same snapshot the client asks for in `select_trainer`, so
 * the client applies it the same way and reconciles.
 *
 * The push answers the revision it produced: the caller tells the client which
 * revision is on its way.
 */
export type StateBroadcaster = {
  pushState(userId: string, trainerId: string): number;
};

/**
 * The broadcaster of the state.
 *
 * The pushes of an account are queued: two commands in a row produce two
 * snapshots, and the second one never overtakes the first.
 */
export function createStateBroadcaster(
  admin: SupabaseClient,
  connections: ConnectionRegistry,
  logger: Logger,
  revs: RevCounter,
): StateBroadcaster {
  const queues = new Map<string, Promise<void>>();

  /**
   * The revision is taken when the push is enqueued, not when the snapshot is
   * built: the state of the account changed at the moment of the command, and
   * the revision has to say so even if the snapshot takes a while to be read.
   */
  function pushState(userId: string, trainerId: string): number {
    const rev = revs.next(userId);
    if (connections.get(userId) === undefined) {
      return rev;
    }
    const previous = queues.get(userId) ?? Promise.resolve();
    const next = previous
      .then(function load(): Promise<void> {
        return loadAndSend(admin, connections, revs, userId, trainerId, rev);
      })
      .catch(function report(error: unknown): void {
        logger.error({ err: error, userId }, 'state push failure');
      })
      .then(function release(): void {
        if (queues.get(userId) === next) {
          queues.delete(userId);
        }
      });
    queues.set(userId, next);
    return rev;
  }

  return { pushState };
}

/**
 * Loads the state and sends it to the channel of the account.
 *
 * The channel is looked up when the snapshot is ready, and not when the push
 * is queued: a connection that was replaced in the meantime receives nothing,
 * and the newer one is the one that gets the state.
 */
function loadAndSend(
  admin: SupabaseClient,
  connections: ConnectionRegistry,
  revs: RevCounter,
  userId: string,
  trainerId: string,
  rev: number,
): Promise<void> {
  const revision = { epoch: revs.epoch, rev };
  return loadPlayerState(admin, trainerId, userId, revision).then(function send(
    state: PlayerState | null,
  ): void {
    const ws = connections.get(userId);
    if (state === null || ws === undefined) {
      return;
    }
    sendMessage(ws, buildStateSnapshot(state));
  });
}
