import type { HuntEndReason } from '@creatures/contracts/huntSession';
import type {
  HuntCreatureActor,
  HuntDelta,
  HuntLedger,
  HuntRuntimeEvent,
  HuntTeamMemberActor,
} from '@creatures/contracts/huntSim';

import type { HuntPhase, HuntSnapshot, HuntStoreState } from './huntStore';

/**
 * The team the bar reads while there is no hunt: a single instance, because a
 * new empty array on every read would re-render the subscribers forever.
 */
const EMPTY_TEAM: HuntTeamMemberActor[] = [];

export function selectAbilities(state: HuntStoreState): HuntSnapshot['abilities'] | null {
  return state.snapshot?.abilities ?? null;
}

export function selectConsumables(state: HuntStoreState): HuntSnapshot['consumables'] | null {
  return state.snapshot?.consumables ?? null;
}

export function selectDevice(state: HuntStoreState): HuntSnapshot['device'] {
  return state.snapshot?.device ?? null;
}

export function selectEndReason(state: HuntStoreState): HuntEndReason | null {
  return state.endReason;
}

export function selectEvents(state: HuntStoreState): HuntRuntimeEvent[] {
  return state.events;
}

export function selectHasSnapshot(state: HuntStoreState): boolean {
  return state.snapshot !== null;
}

export function selectHuntError(state: HuntStoreState): string | null {
  return state.error;
}

export function selectHuntPhase(state: HuntStoreState): HuntPhase {
  return state.phase;
}

export function selectHuntRev(state: HuntStoreState): number {
  return state.huntRev;
}

export function selectHuntSnapshot(state: HuntStoreState): HuntSnapshot | null {
  return state.snapshot;
}

export function selectLedger(state: HuntStoreState): HuntLedger | null {
  return state.snapshot?.ledger ?? null;
}

export function selectPlayer(state: HuntStoreState): HuntCreatureActor | null {
  return state.snapshot?.player ?? null;
}

export function selectSession(state: HuntStoreState): HuntSnapshot['session'] | null {
  return state.snapshot?.session ?? null;
}

export function selectTeam(state: HuntStoreState): HuntTeamMemberActor[] {
  return state.snapshot?.team ?? EMPTY_TEAM;
}

export function selectTrainer(state: HuntStoreState): HuntSnapshot['trainer'] | null {
  return state.snapshot?.trainer ?? null;
}

export function selectVitals(
  state: HuntStoreState,
): { hp: number; id: string; maxHp: number } | null {
  const player = state.snapshot?.player;
  if (player === undefined) {
    return null;
  }
  return { hp: player.hp, id: player.id, maxHp: player.maxHp };
}

export function selectWaves(state: HuntStoreState): HuntDelta['waves'] | null {
  return state.snapshot?.waves ?? null;
}

export function selectWilds(state: HuntStoreState): HuntCreatureActor[] {
  return state.snapshot?.wilds ?? [];
}
