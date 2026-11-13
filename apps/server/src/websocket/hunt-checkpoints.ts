import type { SupabaseClient } from '@supabase/supabase-js';

import type { HuntEngineSnapshot } from './hunt-engine.ts';

export type HuntCheckpointRequest = {
  checkpointId: string;
  expectedRevision: number;
  fallbackActiveCreatureId?: string;
  finishHunt: boolean;
  snapshot: HuntEngineSnapshot;
};

export type HuntCheckpointResult = {
  applied: boolean;
  finished: boolean;
  nextRevision: number | null;
};

type ExperienceDelta = { amount: number; creatureId: string };
type ExperienceDeltas = Array<ExperienceDelta>;
type ExperienceEntry = [string, number];
type AbilityCooldowns = Record<string, Record<string, number>>;
type CheckpointRow = {
  applied?: unknown;
  finished?: unknown;
  next_revision?: unknown;
};
type RuntimeSnapshot = Omit<HuntEngineSnapshot, 'xpPending'> & {
  xpPending: Record<string, never>;
};

function compareExperienceDeltas(first: ExperienceDelta, second: ExperienceDelta): number {
  return first.creatureId.localeCompare(second.creatureId);
}

function toExperienceDelta(entry: ExperienceEntry): ExperienceDelta {
  const [creatureId, amount] = entry;
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`Invalid pending experience for creature ${creatureId}`);
  }
  return { amount, creatureId };
}

function experienceDeltas(snapshot: HuntEngineSnapshot): ExperienceDeltas {
  const emptyPending: Record<string, number> = {};
  const pending = snapshot.xpPending ?? emptyPending;
  const pendingEntries = Object.entries(pending);
  const deltas = pendingEntries.map(toExperienceDelta);
  return deltas.toSorted(compareExperienceDeltas);
}

function activeCreatureId(input: HuntCheckpointRequest): string {
  const { fallbackActiveCreatureId, finishHunt, snapshot } = input;
  if (finishHunt && snapshot.activeCreatureId.length === 0) {
    if (!fallbackActiveCreatureId) {
      throw new Error('A fallback active creature ID is required to finish this hunt');
    }
    return fallbackActiveCreatureId;
  }
  return snapshot.activeCreatureId;
}

function runtimeSnapshot(snapshot: HuntEngineSnapshot): RuntimeSnapshot {
  const emptyPending: Record<string, never> = {};
  const snapshotWithoutPending = { ...snapshot, xpPending: emptyPending };
  const serializedSnapshot = JSON.stringify(snapshotWithoutPending);
  return JSON.parse(serializedSnapshot) as RuntimeSnapshot;
}

function checkpointResult(data: unknown): HuntCheckpointResult {
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error('Invalid checkpoint response');
  }
  const row = data[0] as CheckpointRow;
  const validRevision = row.next_revision === null || Number.isSafeInteger(row.next_revision);
  if (typeof row.applied !== 'boolean' || typeof row.finished !== 'boolean' || !validRevision) {
    throw new Error('Invalid checkpoint response row');
  }
  return {
    applied: row.applied,
    finished: row.finished,
    nextRevision: row.next_revision as number | null,
  };
}

export async function writeHuntCheckpoint(
  client: SupabaseClient,
  input: HuntCheckpointRequest,
): Promise<HuntCheckpointResult> {
  const { checkpointId, expectedRevision, finishHunt, snapshot } = input;
  const emptyCooldowns: AbilityCooldowns = {};
  const combatEvents: Array<never> = [];
  const params = {
    checkpoint_id: checkpointId,
    expected_hunt_id: snapshot.huntId,
    expected_revision: expectedRevision,
    experience_deltas: experienceDeltas(snapshot),
    finish_hunt: finishHunt,
    next_ability_cooldowns: snapshot.abilityCooldowns ?? emptyCooldowns,
    next_active_creature_health: snapshot.activeCreatureHealth,
    next_active_creature_id: activeCreatureId(input),
    next_combat_events: combatEvents,
    next_enemies: snapshot.enemies,
    next_event_time: new Date(snapshot.nextEventAt).toISOString(),
    next_player_position: snapshot.playerPosition,
    next_runtime_snapshot: runtimeSnapshot(snapshot),
    next_wave: snapshot.wave,
  };
  const { data, error } = await client.rpc('checkpoint_character_hunt', params);
  if (error) {
    throw error;
  }
  return checkpointResult(data);
}
