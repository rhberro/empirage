/* eslint-disable max-lines -- the snapshot and the actions that mutate it stay together */
import type { ActorMedia, PathSegment } from '@creatures/contracts/world';
import { useStore } from 'zustand/react';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';

import { mergeMoveResult } from './prediction';
import { createServerClock, serverClock, type ServerClock } from './serverClock';

/**
 * The revision of a client that never received the world.
 *
 * The first message of the server is accepted whatever revision it carries:
 * the counter starts in memory, and the client cannot assume where it starts.
 */
const NO_WORLD = -1;

/**
 * The world the server pushed.
 */
export type WorldStateMessage = {
  actors: ActorMedia[];
  worldRev: number;
  you: ActorMedia;
};

export type WorldActorUpdate = {
  actor: ActorMedia;
  worldRev: number;
};

export type WorldActorLeave = {
  actorId: string;
  worldRev: number;
};

/**
 * The answer of the server to a move.
 *
 * Only the fields the world cares about: the walk that was planned, whether
 * the server accepted it and the revision it produced.
 */
export type WorldMoveResult = {
  ok: boolean;
  path: PathSegment[];
  worldRev: number;
};

export type WorldSnapshot = {
  /** The actors the observer sees, by id. */
  actors: Record<string, ActorMedia>;
  /** The walk of the player in course, empty when the player is idle. */
  path: PathSegment[];
  /** The first step of the player's click, before the server answers. */
  prediction: PathSegment | null;
  /** The reading of the clock of the server in the last snapshot. */
  serverNow: number;
  /** The revision of the world that is applied. */
  worldRev: number;
  /** The actor of the connection. */
  you: ActorMedia | null;
};

export type WorldActions = {
  /** Removes an actor that left the city. */
  applyActorLeave(leave: WorldActorLeave): void;
  /** Applies an actor that entered the city or started a step. */
  applyActorUpdate(update: WorldActorUpdate): void;
  /**
   * Applies the answer of a move.
   *
   * The walk replaces the step the player had: its first segment starts on the
   * tile the server confirmed, and the rest of the walk is what the client
   * interpolates.
   */
  applyMoveResult(result: WorldMoveResult): void;
  /** Applies the dynamic part of the world the server pushed. */
  applyWorldState(world: WorldStateMessage): void;
  /** Forgets the predicted step. */
  clearPrediction(): void;
  /** Reads the clock of the server, corrected by the drift of the client. */
  now(): number;
  /** Shows the first step of a click before the server answers. */
  predictMove(segment: PathSegment): void;
  /** Reads the server clock minus the playback buffer. */
  renderNow(): number;
  /** Forgets the world: the connection fell or the trainer changed. */
  resetWorld(): void;
  /** Corrects the clock of the client by a reading of the server. */
  syncServerTime(serverNow: number): void;
};

export type WorldStoreState = WorldSnapshot & WorldActions;

export type WorldStore = StoreApi<WorldStoreState>;

export type WorldStoreOptions = {
  /** The clock shared with the connection; a fresh one in the tests. */
  clock?: ServerClock;
};

/**
 * The dynamic world of the game.
 *
 * The store lives outside the page because the world is not the screen that
 * draws it: it is the truth the renderer reads every frame, and the same one
 * the channel writes. The revision is its own — the state of the player has a
 * revision, and the world cannot share it — so a message that arrives late is
 * discarded by number and never puts the world back in the past.
 */
export function createWorldStore(options?: WorldStoreOptions): WorldStore {
  return createStore<WorldStoreState>(buildInitializer(options?.clock ?? createServerClock()));
}

export const worldStore: WorldStore = createWorldStore({ clock: serverClock });

/**
 * Reads a piece of the world.
 */
export function useWorldState<T>(selector: (state: WorldStoreState) => T): T {
  return useStore(worldStore, selector);
}

function buildInitializer(clock: ServerClock): StateCreator<WorldStoreState> {
  return function initialize(set, get): WorldStoreState {
    return {
      ...buildInitialSnapshot(),
      ...buildActions(set, get, clock),
    };
  };
}

function buildInitialSnapshot(): WorldSnapshot {
  return { actors: {}, path: [], prediction: null, serverNow: 0, worldRev: NO_WORLD, you: null };
}

function buildActions(
  set: (partial: Partial<WorldStoreState>) => void,
  get: () => WorldStoreState,
  clock: ServerClock,
): WorldActions {
  return {
    applyActorLeave: buildApplyActorLeave(set, get),
    applyActorUpdate: buildApplyActorUpdate(set, get),
    applyMoveResult: buildApplyMoveResult(set, get),
    applyWorldState: buildApplyWorldState(set, get),
    clearPrediction: buildClearPrediction(set),
    now: buildNow(clock),
    predictMove: buildPredictMove(set),
    renderNow: buildRenderNow(clock),
    resetWorld: buildResetWorld(set, clock),
    syncServerTime: buildSyncServerTime(set, clock),
  };
}

function buildApplyWorldState(
  set: (partial: Partial<WorldStoreState>) => void,
  get: () => WorldStoreState,
): (world: WorldStateMessage) => void {
  return function applyWorldState(world: WorldStateMessage): void {
    if (!isNewerWorld(world.worldRev, get().worldRev)) {
      return;
    }
    set({
      actors: buildActorMap(world.actors),
      path: readWalk(world.you),
      prediction: null,
      worldRev: world.worldRev,
      you: world.you,
    });
  };
}

/**
 * An actor that entered the city or started a step.
 *
 * The server sends the whole actor and not the change: an update that arrives
 * after a newer revision is old news, and the revision is what says it.
 */
function buildApplyActorUpdate(
  set: (partial: Partial<WorldStoreState>) => void,
  get: () => WorldStoreState,
): (update: WorldActorUpdate) => void {
  return function applyActorUpdate(update: WorldActorUpdate): void {
    const current = get();
    if (!isNewerWorld(update.worldRev, current.worldRev)) {
      return;
    }
    const actors = { ...current.actors, [update.actor.actorId]: update.actor };
    if (current.you?.actorId !== update.actor.actorId) {
      set({ actors, worldRev: update.worldRev });
      return;
    }
    set({
      actors,
      path: readWalk(update.actor),
      prediction: null,
      worldRev: update.worldRev,
      you: update.actor,
    });
  };
}

function buildApplyActorLeave(
  set: (partial: Partial<WorldStoreState>) => void,
  get: () => WorldStoreState,
): (leave: WorldActorLeave) => void {
  return function applyActorLeave(leave: WorldActorLeave): void {
    const current = get();
    if (!isNewerWorld(leave.worldRev, current.worldRev)) {
      return;
    }
    const actors = withoutActor(current.actors, leave.actorId);
    if (current.you?.actorId !== leave.actorId) {
      set({ actors, worldRev: leave.worldRev });
      return;
    }
    set({ actors, path: [], prediction: null, worldRev: leave.worldRev, you: null });
  };
}

/**
 * The answer of a move.
 *
 * The server is the one that plans the walk: the client throws away the step
 * it had and takes the first segment of the answer as the confirmed tile and
 * the step in course. The first segment may have started in the past, when
 * the answer replans a step that was already on screen: its timestamps are
 * kept, so the renderer continues the step instead of restarting it. A refused
 * answer changes no position; it only says that the world moved on.
 */
function buildApplyMoveResult(
  set: (partial: Partial<WorldStoreState>) => void,
  get: () => WorldStoreState,
): (result: WorldMoveResult) => void {
  return function applyMoveResult(result: WorldMoveResult): void {
    const current = get();
    if (!isNewerWorld(result.worldRev, current.worldRev)) {
      return;
    }
    if (!result.ok) {
      set({ prediction: null, worldRev: result.worldRev });
      return;
    }
    if (result.path.length === 0) {
      set({
        path: [],
        prediction: null,
        worldRev: result.worldRev,
        you: current.you === null ? null : { ...current.you, segment: undefined },
      });
      return;
    }
    const path = mergeMoveResult(current.prediction, result.path);
    const [first] = path;
    const you = current.you;
    if (you === null) {
      set({ path, prediction: null, worldRev: result.worldRev });
      return;
    }
    set({
      path,
      prediction: null,
      worldRev: result.worldRev,
      you: { ...you, dir: first.dir, position: first.from, segment: first },
    });
  };
}

function buildPredictMove(
  set: (partial: Partial<WorldStoreState>) => void,
): (segment: PathSegment) => void {
  return function predictMove(segment: PathSegment): void {
    set({ prediction: segment });
  };
}

function buildClearPrediction(set: (partial: Partial<WorldStoreState>) => void): () => void {
  return function clearPrediction(): void {
    set({ prediction: null });
  };
}

function buildSyncServerTime(
  set: (partial: Partial<WorldStoreState>) => void,
  clock: ServerClock,
): (serverNow: number) => void {
  return function syncServerTime(serverNow: number): void {
    clock.seed(serverNow);
    set({ serverNow });
  };
}

function buildNow(clock: ServerClock): () => number {
  return function now(): number {
    return clock.now();
  };
}

function buildRenderNow(clock: ServerClock): () => number {
  return function renderNow(): number {
    return clock.renderNow();
  };
}

function buildResetWorld(
  set: (partial: Partial<WorldStoreState>) => void,
  clock: ServerClock,
): () => void {
  return function resetWorld(): void {
    clock.reset();
    set(buildInitialSnapshot());
  };
}

function isNewerWorld(incoming: number, current: number): boolean {
  return incoming > current;
}

function readWalk(actor: ActorMedia): PathSegment[] {
  return actor.segment === undefined ? [] : [actor.segment];
}

function buildActorMap(actors: ActorMedia[]): Record<string, ActorMedia> {
  const map: Record<string, ActorMedia> = {};
  for (const actor of actors) {
    map[actor.actorId] = actor;
  }
  return map;
}

function withoutActor(
  actors: Record<string, ActorMedia>,
  actorId: string,
): Record<string, ActorMedia> {
  const next: Record<string, ActorMedia> = {};
  for (const entry of Object.entries(actors)) {
    if (entry[0] !== actorId) {
      next[entry[0]] = entry[1];
    }
  }
  return next;
}
