import type { PlayerState } from '@creatures/contracts/player';

import { createApiDeps, requestPlayerState } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

import { decideRevision, isRevisionGap } from './playerStateRevision';
import type { AppliedRevision } from './playerStateRevision';

/**
 * How long the client waits for the state that a command produced.
 *
 * The command is answered by the channel of the game, and the state that
 * carries the change comes with the answer. Two seconds is the time the server
 * takes to apply a command and to push the state that follows it. When the
 * state does not come, the client asks for it over REST.
 */
export const COMMAND_STATE_TIMEOUT_MS = 2000;

/**
 * How long the client waits before asking for the state that a gap of
 * revision announced.
 *
 * A gap means that a state was lost on the way, and the state right after it
 * can be lost too. The wait keeps a burst of pushes from turning into a
 * burst of requests.
 */
const GAP_FALLBACK_DEBOUNCE_MS = 1000;

/** Where the state came from. */
export type PlayerStateSource = 'fallback' | 'push' | 'rest';

export type PlayerStateListener = (state: PlayerState, source: PlayerStateSource) => void;

/** How the client asks the server for the state it is missing. */
export type FallbackRequester = (sinceRev?: number) => Promise<PlayerState | null>;

export type PlayerStateSync = {
  /** Applies a state and tells the listeners about it. */
  publish(state: PlayerState, source: PlayerStateSource): void;
  /** The revision of the state that is applied. */
  readRevision(): AppliedRevision | null;
  /** The clock of the server, corrected by the drift of the client. */
  readServerTime(): number;
  /** Asks the server for the state that the client is missing. */
  requestFallback(sinceRev?: number): Promise<void>;
  /** Listens to the states that are applied. */
  subscribe(listener: PlayerStateListener): () => void;
  /** Waits for a state that is newer than the revision given. */
  waitForNewerState(expectedRev: number, timeoutMs: number): Promise<boolean>;
};

export type PlayerStateSyncOptions = {
  /** How long the client waits before asking for the state of a gap. */
  gapDebounceMs?: number;
  /** How the client asks the server for the state it is missing. */
  requestFallback?: FallbackRequester;
};

/**
 * A client that waits for a state.
 */
type StateWaiter = {
  /** The revision the waiter is waiting for. */
  expected: AppliedRevision;
  /** Answers the waiter. */
  settle: (applied: boolean) => void;
};

/**
 * The state of the synchronization.
 */
type SyncState = {
  /** How far the clock of the client is from the clock of the server. */
  clockOffsetMs: number;
  /** The timer of the wait before the search of a state. */
  fallbackTimer: ReturnType<typeof setTimeout> | null;
  /** The consumers of the state. */
  listeners: Set<PlayerStateListener>;
  /** The revision of the state that is applied. */
  revision: AppliedRevision | null;
  /** The clients that wait for a state. */
  waiters: Set<StateWaiter>;
};

/**
 * The truth of the state of the player, shared by everyone who reads it.
 *
 * The module lives in the team slice because it is the lowest slice that the
 * screen, the features and the entities can all reach: the state that the
 * channel pushes is the same truth that the team, the panel of abilities and
 * the commands of the client read.
 */
export function createPlayerStateSync(options: PlayerStateSyncOptions = {}): PlayerStateSync {
  const gapDebounceMs = options.gapDebounceMs ?? GAP_FALLBACK_DEBOUNCE_MS;
  const requestFallbackState = options.requestFallback ?? readStateOverRest;
  const state: SyncState = {
    clockOffsetMs: 0,
    fallbackTimer: null,
    listeners: new Set<PlayerStateListener>(),
    revision: null,
    waiters: new Set<StateWaiter>(),
  };
  const publish = buildPublish(state, gapDebounceMs, requestFallbackState);
  return {
    publish,
    readRevision: buildReadRevision(state),
    readServerTime: buildReadServerTime(state),
    requestFallback: buildRequestFallback(requestFallbackState, publish),
    subscribe: buildSubscribe(state),
    waitForNewerState: buildWaitForNewerState(state),
  };
}

function buildPublish(
  state: SyncState,
  gapDebounceMs: number,
  requestFallbackState: FallbackRequester,
): (playerState: PlayerState, source: PlayerStateSource) => void {
  return function publish(playerState: PlayerState, source: PlayerStateSource): void {
    const incoming: AppliedRevision = { epoch: playerState.epoch, rev: playerState.rev };
    // The global registry is guarded by the revision too: a state that is old
    // and that arrives by a path without a gate cannot make the global
    // revision go backwards. An ignored state is not told to the listeners
    // either: no consumer has to see a state that the client left behind.
    const decision = decideRevision(state.revision, incoming);
    if (decision === 'ignore') {
      return;
    }
    const previous = state.revision;
    state.revision = incoming;
    state.clockOffsetMs = playerState.serverNow - Date.now();
    if (source !== 'fallback' && isRevisionGap(previous, incoming)) {
      scheduleFallback(state, gapDebounceMs, requestFallbackState);
    }
    notifyListeners(state, playerState, source);
    releaseWaiters(state, incoming);
  };
}

function buildReadRevision(state: SyncState): () => AppliedRevision | null {
  return function readRevision(): AppliedRevision | null {
    return state.revision;
  };
}

function buildReadServerTime(state: SyncState): () => number {
  return function readServerTime(): number {
    return Date.now() + state.clockOffsetMs;
  };
}

function buildRequestFallback(
  requestFallbackState: FallbackRequester,
  publish: (playerState: PlayerState, source: PlayerStateSource) => void,
): (sinceRev?: number) => Promise<void> {
  return function requestFallback(sinceRev?: number): Promise<void> {
    return requestFallbackState(sinceRev).then(function applyFallback(
      playerState: PlayerState | null,
    ): void {
      if (playerState === null) {
        return;
      }
      publish(playerState, 'fallback');
    });
  };
}

function buildSubscribe(state: SyncState): (listener: PlayerStateListener) => () => void {
  return function subscribe(listener: PlayerStateListener): () => void {
    state.listeners.add(listener);
    return function unsubscribe(): void {
      state.listeners.delete(listener);
    };
  };
}

function buildWaitForNewerState(
  state: SyncState,
): (expectedRev: number, timeoutMs: number) => Promise<boolean> {
  return function waitForNewerState(expectedRev: number, timeoutMs: number): Promise<boolean> {
    const current = state.revision;
    const expected: AppliedRevision = { epoch: current?.epoch ?? '', rev: expectedRev };
    if (current !== null && isNewerThan(current, expected)) {
      return Promise.resolve(true);
    }
    return new Promise(function waitForState(resolve: (applied: boolean) => void): void {
      let settled = false;
      const waiter: StateWaiter = { expected, settle: settleWaiter };
      const timer = setTimeout(function onTimeout(): void {
        settleWaiter(false);
      }, timeoutMs);
      function settleWaiter(applied: boolean): void {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        state.waiters.delete(waiter);
        resolve(applied);
      }
      state.waiters.add(waiter);
    });
  };
}

function notifyListeners(
  state: SyncState,
  playerState: PlayerState,
  source: PlayerStateSource,
): void {
  for (const listener of state.listeners) {
    listener(playerState, source);
  }
}

function releaseWaiters(state: SyncState, incoming: AppliedRevision): void {
  for (const waiter of state.waiters) {
    if (isNewerThan(incoming, waiter.expected)) {
      waiter.settle(true);
    }
  }
}

/**
 * The search of the state that a gap announced.
 *
 * The wait keeps a burst of pushes from turning into a burst of requests: the
 * search that is already waiting is the one that goes out.
 */
function scheduleFallback(
  state: SyncState,
  gapDebounceMs: number,
  requestFallbackState: FallbackRequester,
): void {
  if (state.fallbackTimer !== null) {
    return;
  }
  state.fallbackTimer = setTimeout(function runFallback(): void {
    state.fallbackTimer = null;
    void requestFallbackState(state.revision?.rev);
  }, gapDebounceMs);
}

/**
 * Whether the state that arrived is newer than the one the waiter waits for.
 *
 * A new epoch carries everything the client had, so it answers a waiter that
 * waits for a revision of the old epoch.
 */
function isNewerThan(incoming: AppliedRevision, expected: AppliedRevision): boolean {
  if (incoming.epoch !== expected.epoch) {
    return true;
  }
  return incoming.rev > expected.rev;
}

/**
 * The state of the player, read over REST.
 *
 * The revision narrows the answer: the server only sends the state when it
 * is newer than the revision that was asked for.
 */
function readStateOverRest(sinceRev?: number): Promise<PlayerState | null> {
  return requestPlayerState(createApiDeps(getAccessToken), sinceRev).then(
    function readState(result): PlayerState | null {
      return result.ok ? result.state : null;
    },
  );
}

export const playerStateSync: PlayerStateSync = createPlayerStateSync();

/**
 * The revision of the state that the client has applied.
 *
 * A command that goes out registers this revision: the state that confirms
 * the command is the one that is newer than it.
 */
export function readAppliedRevision(): number {
  return playerStateSync.readRevision()?.rev ?? 0;
}

/**
 * Waits for the state that a command produced.
 *
 * The state comes by the channel of the game. When it does not come in time,
 * the client asks for it over REST: the command was accepted by the server,
 * and the state of the server is the truth.
 */
export function awaitStateAfterCommand(expectedRev: number): Promise<void> {
  return playerStateSync
    .waitForNewerState(expectedRev, COMMAND_STATE_TIMEOUT_MS)
    .then(function handleWait(applied: boolean): Promise<void> | void {
      if (applied) {
        return;
      }
      return playerStateSync.requestFallback(expectedRev);
    });
}
