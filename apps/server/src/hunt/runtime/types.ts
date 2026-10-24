import type { HuntEndReason, HuntSession } from '@creatures/contracts/huntSession';
import type { HuntDelta, HuntEndedMessage, HuntSnapshot } from '@creatures/contracts/huntSim';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';

import type { SimContent, SimState } from '~/hunt/sim';

/**
 * What the connection already has, so the next delta only carries the change.
 *
 * The signatures are per field: an actor travels when its life, facing, target,
 * behavior or step changed; a list travels when its contents changed.
 */
export type HuntDeliveredState = {
  abilities: string;
  actors: Map<string, string>;
  consumables: string;
  device: string;
  ledger: string;
  team: string;
  trainer: string;
  waves: string;
};

/**
 * The timer that wakes the hunt on its next interesting instant.
 *
 * The scheduler is the normal publisher; the periodic runner is only the
 * watchdog for a timer that was lost.
 */
export type HuntScheduler = {
  arm(trainerId: string): void;
  clear(trainerId: string): void;
  stop(): void;
};

/**
 * The hunt that is alive in this process.
 *
 * The state is the source of truth while the hunt runs; the row is only the
 * checkpoint. Everything the runtime needs to resume is either here or in the
 * simulation state that is written every couple of seconds.
 */
export type HuntRuntime = {
  accountId: string;
  areaId: string;
  areaName: string;
  areaSlug: string;
  content: SimContent;
  /** What was already written to the backpack, so a close does not duplicate. */
  credited: {
    drops: Record<string, number>;
    spent: Record<string, number>;
  };
  /** Whether a checkpoint is being written in the background. */
  checkpointing: boolean;
  /** The baseline of the incremental delta. */
  delivered: HuntDeliveredState;
  dirty: boolean;
  endsAt: number;
  huntRev: number;
  lastCheckpointAt: number;
  lastWildIds: string[];
  /** The checkpoint in flight, which a close must wait for before the final write. */
  pendingCheckpoint: Promise<void> | null;
  sessionId: string;
  /** The backpack writes of the events, in order; a close waits for them. */
  sideEffects: Promise<void>;
  staminaAtStart: number;
  startedAt: number;
  state: SimState;
  trainerId: string;
  /** Bumped on every advance, so a checkpoint does not mark a newer state clean. */
  version: number;
  /** Why the window closes, which the simulation itself cannot label. */
  windowEndReason: Extract<HuntEndReason, 'stamina_depleted' | 'offline_session_expired'>;
};

export type HuntManagerDeps = {
  admin: SupabaseClient;
  logger?: Logger;
  now?: () => number;
  /**
   * Called when a delta needs to go to the connection of the account.
   *
   * The account comes with the trainer because a connection belongs to the
   * account, and the registry of the channels is keyed by it.
   */
  onDelta?: (accountId: string, trainerId: string, delta: HuntDelta) => void;
  /** Called when the hunt ends. */
  onEnded?: (accountId: string, trainerId: string, ended: HuntEndedMessage) => void;
  /** Called when a snapshot needs to go to the connection of the account. */
  onSnapshot?: (accountId: string, trainerId: string, snapshot: HuntSnapshot) => void;
};

export type HuntManager = {
  advance(trainerId: string): Promise<HuntDelta | null>;
  advanceAll(): Promise<void>;
  close(trainerId: string, reason: HuntEndReason): Promise<void>;
  finalize(trainerId: string): Promise<void>;
  has(trainerId: string): boolean;
  hydrate(session: HuntSession): Promise<void>;
  refreshLoadout(trainerId: string): Promise<void>;
  snapshot(trainerId: string): Promise<HuntSnapshot | null>;
  start(input: { accountId: string; areaId: string; trainerId: string }): Promise<HuntSnapshot>;
  /** Stops the timers of every hunt; the process is going away or the tests ended. */
  stop(): void;
  swap(trainerId: string, creatureId: string): Promise<boolean>;
  sweep(): Promise<void>;
};
