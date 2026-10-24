import type { HuntEndReason } from '@creatures/contracts/huntSession';
import type {
  HuntCreatureActor,
  HuntDelta,
  HuntEndedMessage,
  HuntRuntimeEvent,
  HuntSnapshot as ContractHuntSnapshot,
} from '@creatures/contracts/huntSim';
import { useStore } from 'zustand/react';
import { useShallow } from 'zustand/react/shallow';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import { worldStore } from '~/entities/world';

const FIRST_HUNT_REV = 0;
const EVENT_WINDOW_MS = 5000;

/**
 * The snapshot of the hunt, with the wild creatures the server sends.
 *
 * The contract still does not type the wilds of the snapshot: they travel in
 * the snapshot while the hunt scene grows, and the delta already types them.
 */
export type HuntSnapshot = ContractHuntSnapshot & {
  wilds?: HuntCreatureActor[];
};

export type HuntPhase = 'idle' | 'entering' | 'active' | 'leaving';

export type HuntSnapshotState = {
  /** Why the hunt ended, when it ended. */
  endReason: HuntEndReason | null;
  /** The session the client is in, incremented when the hunt is forgotten. */
  epoch: number;
  /** The last error of the hunt, when there is one. */
  error: string | null;
  /** The facts of the last seconds, in the order the server applied them. */
  events: HuntRuntimeEvent[];
  /** The revision of the hunt that is applied. */
  huntRev: number;
  /** Where the client is in the flow of the hunt. */
  phase: HuntPhase;
  /** The state the server pushed, kept while the hunt ends. */
  snapshot: HuntSnapshot | null;
};

export type HuntActions = {
  /** Applies what changed in the hunt since the previous message. */
  applyDelta(delta: HuntDelta): void;
  /** The hunt ended: keeps the final state for the screen of the exit. */
  applyEnded(ended: HuntEndedMessage): void;
  /** Applies the snapshot the server sent when the connection entered. */
  applySnapshot(snapshot: HuntSnapshot): void;
  /** The player is entering the hunt: the screen waits for the snapshot. */
  beginEntering(): void;
  /** Forgets the hunt: the connection fell or the hunt ended. */
  resetHunt(): void;
  /** Shows the reason the hunt could not start. */
  setError(message: string): void;
};

export type HuntStoreState = HuntSnapshotState & HuntActions;

export type HuntStore = StoreApi<HuntStoreState>;

/**
 * The hunt the server is running.
 *
 * The store lives outside the page because the hunt is not the screen that
 * draws it: it is the state the channel writes and the scene reads. The
 * revision is its own — the world and the player state have theirs — so a
 * message that arrives late is discarded by number.
 */
export function createHuntStore(): HuntStore {
  return createStore<HuntStoreState>(buildInitializer());
}

export const huntStore: HuntStore = createHuntStore();

/**
 * Reads a piece of the hunt.
 */
export function useHuntState<T>(selector: (state: HuntStoreState) => T): T {
  return useStore(huntStore, selector);
}

/**
 * Reads a piece of the hunt comparing the result shallowly.
 *
 * For object selections such as the vitals, the shallow comparison re-renders
 * only when a primitive field changes — the life of a creature, not its step.
 */
export function useHuntStateShallow<T>(selector: (state: HuntStoreState) => T): T {
  return useStore(huntStore, useShallow(selector));
}

function buildInitializer(): StateCreator<HuntStoreState> {
  return function initialize(set, get): HuntStoreState {
    return {
      ...buildInitialState(),
      ...buildActions(set, get),
    };
  };
}

function buildInitialState(): HuntSnapshotState {
  return {
    endReason: null,
    epoch: 0,
    error: null,
    events: [],
    huntRev: FIRST_HUNT_REV,
    phase: 'idle',
    snapshot: null,
  };
}

function buildActions(
  set: (partial: Partial<HuntStoreState>) => void,
  get: () => HuntStoreState,
): HuntActions {
  return {
    applyDelta: buildApplyDelta(set, get),
    applyEnded: buildApplyEnded(set, get),
    applySnapshot: buildApplySnapshot(set, get),
    beginEntering: buildBeginEntering(set, get),
    resetHunt: buildResetHunt(set, get),
    setError: buildSetError(set),
  };
}

function buildApplySnapshot(
  set: (partial: Partial<HuntStoreState>) => void,
  get: () => HuntStoreState,
): (snapshot: HuntSnapshot) => void {
  return function applySnapshot(snapshot: HuntSnapshot): void {
    const current = get();
    if (current.snapshot !== null && snapshot.huntRev < current.huntRev) {
      return;
    }
    worldStore.getState().syncServerTime(snapshot.serverNow);
    set({
      endReason: null,
      error: null,
      events: [],
      huntRev: snapshot.huntRev,
      phase: 'active',
      snapshot: withoutPlayerInWilds(snapshot),
    });
  };
}

function buildApplyDelta(
  set: (partial: Partial<HuntStoreState>) => void,
  get: () => HuntStoreState,
): (delta: HuntDelta) => void {
  return function applyDelta(delta: HuntDelta): void {
    const current = get();
    if (current.snapshot === null || delta.huntRev <= current.huntRev) {
      return;
    }
    set({
      events: mergeEvents(current.events, delta.events, delta.at),
      huntRev: delta.huntRev,
      snapshot: mergeSnapshot(current.snapshot, delta),
    });
  };
}

function buildApplyEnded(
  set: (partial: Partial<HuntStoreState>) => void,
  get: () => HuntStoreState,
): (ended: HuntEndedMessage) => void {
  return function applyEnded(ended: HuntEndedMessage): void {
    const current = get();
    const huntRev = Math.max(current.huntRev, ended.huntRev);
    const snapshot =
      current.snapshot === null ? null : { ...current.snapshot, huntRev, ledger: ended.ledger };
    set({ endReason: ended.reason, huntRev, phase: 'leaving', snapshot });
  };
}

function buildBeginEntering(
  set: (partial: Partial<HuntStoreState>) => void,
  get: () => HuntStoreState,
): () => void {
  return function beginEntering(): void {
    set({
      endReason: null,
      epoch: get().epoch + 1,
      error: null,
      events: [],
      huntRev: FIRST_HUNT_REV,
      phase: 'entering',
      snapshot: null,
    });
  };
}

function buildResetHunt(
  set: (partial: Partial<HuntStoreState>) => void,
  get: () => HuntStoreState,
): () => void {
  return function resetHunt(): void {
    set({ ...buildInitialState(), epoch: get().epoch + 1 });
  };
}

function buildSetError(set: (partial: Partial<HuntStoreState>) => void): (message: string) => void {
  return function setError(message: string): void {
    set({ error: message });
  };
}

function mergeEvents(
  current: HuntRuntimeEvent[],
  incoming: HuntRuntimeEvent[],
  at: number,
): HuntRuntimeEvent[] {
  return [...current, ...incoming].filter(function isRecent(event: HuntRuntimeEvent): boolean {
    return event.at >= at - EVENT_WINDOW_MS;
  });
}

function mergeSnapshot(snapshot: HuntSnapshot, delta: HuntDelta): HuntSnapshot {
  return {
    ...snapshot,
    abilities: delta.abilities ?? snapshot.abilities,
    consumables: delta.consumables ?? snapshot.consumables,
    device: delta.device === undefined ? snapshot.device : delta.device,
    huntRev: delta.huntRev,
    ledger: delta.ledger ?? snapshot.ledger,
    player: mergePlayer(snapshot.player, delta.upserts),
    team: delta.team ?? snapshot.team,
    trainer: delta.trainer ?? snapshot.trainer,
    waves: delta.waves ?? snapshot.waves,
    wilds: mergeWilds(snapshot.wilds ?? [], delta),
  };
}

/**
 * The active creature is the one the upserts replace, whatever its id is: a
 * swap sends the new active as a player actor.
 */
function mergePlayer(player: HuntCreatureActor, upserts: HuntCreatureActor[]): HuntCreatureActor {
  let active = player;
  for (const actor of upserts) {
    if (actor.kind === 'player' || actor.id === player.id) {
      active = actor;
    }
  }
  return active;
}

function mergeWilds(wilds: HuntCreatureActor[], delta: HuntDelta): HuntCreatureActor[] {
  const byId = new Map<string, HuntCreatureActor>();
  for (const wild of wilds) {
    if (wild.kind === 'wild') {
      byId.set(wild.id, wild);
    }
  }
  for (const actor of delta.upserts) {
    if (actor.kind === 'wild') {
      byId.set(actor.id, actor);
    }
  }
  for (const id of delta.removed) {
    byId.delete(id);
  }
  return [...byId.values()];
}

function withoutPlayerInWilds(snapshot: HuntSnapshot): HuntSnapshot {
  if (snapshot.wilds === undefined) {
    return snapshot;
  }
  return {
    ...snapshot,
    wilds: snapshot.wilds.filter(function isWild(wild: HuntCreatureActor): boolean {
      return wild.id !== snapshot.player.id;
    }),
  };
}
