import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';

import { createServerLogger } from '~/logging/logger';

import type { SerialEnqueue } from './queue';
import { createSerialQueue } from './queue';
import type { HuntManagerDeps, HuntRuntime, HuntScheduler } from './types';

/**
 * The shared state of the manager, passed to the modules that implement the
 * operations of a hunt.
 */
export type HuntManagerState = {
  admin: SupabaseClient;
  deps: HuntManagerDeps;
  enqueue: SerialEnqueue;
  logger: Logger;
  now: () => number;
  runtimes: Map<string, HuntRuntime>;
  /** The timer of the next instant of each hunt; null before the manager wires it. */
  scheduler: HuntScheduler | null;
};

export function createManagerState(deps: HuntManagerDeps): HuntManagerState {
  const logger = deps.logger ?? createServerLogger();
  const now = deps.now ?? Date.now;
  return {
    admin: deps.admin,
    deps,
    enqueue: createSerialQueue(),
    logger,
    now,
    runtimes: new Map<string, HuntRuntime>(),
    scheduler: null,
  };
}
