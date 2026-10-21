import { expect, test } from 'bun:test';

import { buildPlayerStateFixture, FIXTURE_EPOCH } from '~/entities/team/model/playerStateFixture';
import { decideRevision, isRevisionGap } from '~/entities/team/model/playerStateRevision';
import { createPlayerStateSync } from '~/entities/team/model/playerStateSync';
import type { PlayerStateSync } from '~/entities/team/model/playerStateSync';

const DEBOUNCE_MS = 5;
const WAIT_MS = 30;

/**
 * The fallback of the test: the server has nothing newer.
 */
function noState(): Promise<null> {
  return Promise.resolve(null);
}

function waitFor(milliseconds: number): Promise<void> {
  return new Promise(function resolveLater(resolve: () => void): void {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * A server that restarted has a counter that starts over: the state of the
 * new server is taken.
 */
test('a state of another epoch is a resync', function resyncs(): void {
  const decision = decideRevision(
    { epoch: FIXTURE_EPOCH, rev: 10 },
    { epoch: 'another-epoch', rev: 1 },
  );
  expect(decision).toBe('resync');
});

/**
 * A state that is newer than the one the client has is applied.
 */
test('a newer state is applied', function applies(): void {
  const decision = decideRevision(
    { epoch: FIXTURE_EPOCH, rev: 10 },
    { epoch: FIXTURE_EPOCH, rev: 11 },
  );
  expect(decision).toBe('accept');
});

/**
 * A state that is not newer is ignored: a push that arrives late does not put
 * the client back in the past.
 */
test('an older state is ignored', function ignores(): void {
  expect(decideRevision({ epoch: FIXTURE_EPOCH, rev: 10 }, { epoch: FIXTURE_EPOCH, rev: 9 })).toBe(
    'ignore',
  );
  expect(decideRevision({ epoch: FIXTURE_EPOCH, rev: 10 }, { epoch: FIXTURE_EPOCH, rev: 10 })).toBe(
    'ignore',
  );
});

/**
 * A state that skips a revision means that a state was lost on the way.
 */
test('a gap of revision is a gap', function findsGap(): void {
  expect(isRevisionGap({ epoch: FIXTURE_EPOCH, rev: 10 }, { epoch: FIXTURE_EPOCH, rev: 12 })).toBe(
    true,
  );
  expect(isRevisionGap({ epoch: FIXTURE_EPOCH, rev: 10 }, { epoch: FIXTURE_EPOCH, rev: 11 })).toBe(
    false,
  );
  expect(isRevisionGap(null, { epoch: FIXTURE_EPOCH, rev: 12 })).toBe(false);
});

/**
 * A gap makes the client ask for the state that the server has, and the wait
 * keeps a burst of pushes from turning into a burst of requests.
 */
test('a gap makes the client ask for the state', function asksForState(): Promise<void> {
  const asked: (number | undefined)[] = [];
  const sync: PlayerStateSync = createPlayerStateSync({
    gapDebounceMs: DEBOUNCE_MS,
    requestFallback: function requestFallback(sinceRev?: number): Promise<null> {
      asked.push(sinceRev);
      return Promise.resolve(null);
    },
  });
  sync.publish(buildPlayerStateFixture({ rev: 1 }), 'push');
  sync.publish(buildPlayerStateFixture({ rev: 3 }), 'push');
  return waitFor(WAIT_MS).then(function assertRequest(): void {
    expect(asked.length).toBe(1);
    // The client has the revision 3: it asks for the state that is newer.
    expect(asked[0]).toBe(3);
  });
});

/**
 * The state that confirms a command releases the one that waits for it.
 */
test('the state that confirms a command releases the wait', function releases(): Promise<void> {
  const sync = createPlayerStateSync({ requestFallback: noState });
  sync.publish(buildPlayerStateFixture({ rev: 4 }), 'push');
  const waiting = sync.waitForNewerState(4, 1000);
  sync.publish(buildPlayerStateFixture({ rev: 5 }), 'push');
  return waiting.then(function assertApplied(applied: boolean): void {
    expect(applied).toBe(true);
  });
});

/**
 * A command whose state does not arrive in time falls back to the state of
 * the server.
 */
test('the wait of a command ends when the state does not come', function timesOut(): Promise<void> {
  const sync = createPlayerStateSync({ requestFallback: noState });
  return sync.waitForNewerState(4, DEBOUNCE_MS).then(function assertTimeout(
    applied: boolean,
  ): void {
    expect(applied).toBe(false);
  });
});

/**
 * The clock of the client is corrected by the clock of the server: a
 * countdown that comes from a timestamp of the server is right.
 */
test('the clock of the client follows the clock of the server', function correctsClock(): void {
  const sync = createPlayerStateSync({ requestFallback: noState });
  const now = Date.now();
  sync.publish(buildPlayerStateFixture({ serverNow: now + 5000 }), 'push');
  expect(sync.readServerTime()).toBeGreaterThan(now + 4000);
});

/**
 * The global registry is guarded by the revision too: a state that is old
 * and that arrives by a path without a gate cannot make the global revision
 * go backwards, and no consumer sees it.
 */
test('an old state does not go back the global revision', function ignoresOldState(): void {
  const sync = createPlayerStateSync({ requestFallback: noState });
  const seen: number[] = [];
  sync.subscribe(function collect(state): void {
    seen.push(state.rev);
  });
  sync.publish(buildPlayerStateFixture({ rev: 10 }), 'push');
  sync.publish(buildPlayerStateFixture({ rev: 9 }), 'push');
  expect(sync.readRevision()?.rev).toBe(10);
  expect(seen).toEqual([10]);
});

/**
 * A server that restarted has a counter that starts over: the state of the
 * new server takes the place of the old one, and the consumers hear about it.
 */
test('a state of another epoch takes the place of the old one', function takesResync(): void {
  const sync = createPlayerStateSync({ requestFallback: noState });
  const seen: number[] = [];
  sync.subscribe(function collect(state): void {
    seen.push(state.rev);
  });
  sync.publish(buildPlayerStateFixture({ rev: 10 }), 'push');
  sync.publish(buildPlayerStateFixture({ epoch: 'another-epoch', rev: 1 }), 'push');
  expect(sync.readRevision()?.epoch).toBe('another-epoch');
  expect(sync.readRevision()?.rev).toBe(1);
  expect(seen).toEqual([10, 1]);
});

/**
 * A wait for a state is not released by a state that is older than the one
 * that was expected.
 */
test('a wait is not released by an old state', function doesNotRelease(): Promise<void> {
  const sync = createPlayerStateSync({ requestFallback: noState });
  sync.publish(buildPlayerStateFixture({ rev: 10 }), 'push');
  const waiting = sync.waitForNewerState(10, 1000);
  sync.publish(buildPlayerStateFixture({ rev: 9 }), 'push');
  return waiting.then(function assertNotApplied(applied: boolean): void {
    expect(applied).toBe(false);
  });
});
