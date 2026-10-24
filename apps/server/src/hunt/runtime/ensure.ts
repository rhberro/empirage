import type { HuntSnapshot } from '@creatures/contracts/huntSim';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readActiveHuntSession } from '~/hunt/session';

import type { HuntManager } from './types';

/**
 * The dependencies of the hunt that the routes and the channel share.
 */
export type HuntAccessDeps = {
  admin: SupabaseClient;
  hunts: HuntManager;
};

/**
 * The snapshot of the hunt of a trainer, resuming it when the process does not
 * have the runtime yet.
 *
 * A runtime in memory is the source of truth while the hunt runs; a session
 * that is open in the database but not in this process is resumed first, so a
 * client that reconnects after a restart receives the state it left.
 */
export function ensureHunt(deps: HuntAccessDeps, trainerId: string): Promise<HuntSnapshot | null> {
  return deps.hunts.snapshot(trainerId).then(function withRuntime(
    snapshot: HuntSnapshot | null,
  ): HuntSnapshot | null | Promise<HuntSnapshot | null> {
    if (snapshot !== null) {
      return snapshot;
    }
    return readActiveHuntSession(deps.admin, trainerId).then(function withSession(
      session: Awaited<ReturnType<typeof readActiveHuntSession>>,
    ): HuntSnapshot | null | Promise<HuntSnapshot | null> {
      if (session === null) {
        return null;
      }
      return deps.hunts
        .hydrate(session)
        .then(function afterHydrate(): Promise<HuntSnapshot | null> {
          return deps.hunts.snapshot(trainerId);
        });
    });
  });
}
