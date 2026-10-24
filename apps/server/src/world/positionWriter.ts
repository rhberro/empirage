import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';

import { saveTrainerPosition } from '~/db/positionRepository';
import type { TrainerPosition } from '~/db/positionRepository';

/** The window the writes of a trainer are collected in. */
export const POSITION_FLUSH_DELAY_MS = 1_000;

export type PositionWriter = {
  /** Remembers the position of a trainer for the next write. */
  mark(trainerId: string, position: TrainerPosition): void;
  /** Writes the pending position of one trainer now. */
  flush(trainerId: string): Promise<void>;
  /** Writes every pending position now. */
  flushAll(): Promise<void>;
};

export type PositionWriterOptions = {
  admin: SupabaseClient;
  /** The debounce window; the tests shorten it. */
  delayMs?: number;
  logger?: Logger;
};

type WriterState = {
  admin: SupabaseClient;
  chain: Promise<void>;
  delayMs: number;
  logger?: Logger;
  pending: Map<string, TrainerPosition>;
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * The write-behind of the positions, one per process.
 *
 * Every confirmed step marks the position dirty, but the database only sees
 * the last one of the window: a walk of ten steps is one upsert, not ten.
 * The writes are serialized so two flushes of the same trainer cannot land
 * out of order.
 */
export function createPositionWriter(options: PositionWriterOptions): PositionWriter {
  const state: WriterState = {
    admin: options.admin,
    chain: Promise.resolve(),
    delayMs: options.delayMs ?? POSITION_FLUSH_DELAY_MS,
    logger: options.logger,
    pending: new Map<string, TrainerPosition>(),
  };
  return {
    flush(trainerId: string): Promise<void> {
      return write(state, trainerId);
    },
    flushAll(): Promise<void> {
      return write(state);
    },
    mark(trainerId: string, position: TrainerPosition): void {
      state.pending.set(trainerId, position);
      schedule(state);
    },
  };
}

function schedule(state: WriterState): void {
  if (state.timer !== undefined) {
    return;
  }
  state.timer = setTimeout(function onDebounce(): void {
    state.timer = undefined;
    void write(state);
  }, state.delayMs);
}

function take(state: WriterState, trainerId?: string): Map<string, TrainerPosition> {
  if (trainerId === undefined) {
    const batch = state.pending;
    state.pending = new Map();
    return batch;
  }
  const position = state.pending.get(trainerId);
  if (position === undefined) {
    return new Map();
  }
  state.pending.delete(trainerId);
  return new Map([[trainerId, position]]);
}

function write(state: WriterState, trainerId?: string): Promise<void> {
  if (state.timer !== undefined) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
  const batch = take(state, trainerId);
  if (batch.size === 0) {
    return state.chain;
  }
  const task = state.chain.then(function persist(): Promise<void> {
    return persistBatch(batch, state.admin, state.logger).then(function reschedule(): void {
      if (state.pending.size > 0) {
        schedule(state);
      }
    });
  });
  state.chain = task;
  return task;
}

function persistBatch(
  batch: Map<string, TrainerPosition>,
  admin: SupabaseClient,
  logger?: Logger,
): Promise<void> {
  let chain: Promise<void> = Promise.resolve();
  for (const [trainerId, position] of batch) {
    chain = chain.then(function save(): Promise<void> {
      return saveTrainerPosition(admin, trainerId, position).catch(function report(error): void {
        // A lost position write must not take the world down with it: the
        // trainer reconnects on the last position that did land.
        logger?.warn({ err: error, trainerId }, 'trainer position write failed');
      });
    });
  }
  return chain;
}
