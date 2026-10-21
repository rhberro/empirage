import { expect, test } from 'bun:test';

import { buildPlayerStateFixture, FIXTURE_REV } from '~/entities/team';
import { createPlayerStateStore } from '~/pages/play/model/usePlayerState';
import type { PlayerStateResult } from '~/shared/api';

const TIMEOUT_MS = 10;
const WAIT_MS = 60;

function hangingRequest(): Promise<PlayerStateResult> {
  return new Promise(function neverAnswer(): void {
    void 0;
  });
}

function waitFor(milliseconds: number): Promise<void> {
  return new Promise(function resolveLater(resolve: () => void): void {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * A request that never answers cannot leave the screen loading forever: the
 * guard gives up on it and the screen falls into the state of the lost
 * connection.
 */
function loadingStateBecomesTheLostConnection(): Promise<void> {
  const store = createPlayerStateStore({ requestState: hangingRequest, timeoutMs: TIMEOUT_MS });
  store.getState().load();
  return waitFor(WAIT_MS).then(function assertSnapshot(): void {
    const snapshot = store.getState();
    expect(snapshot.status).toBe('error');
    expect(snapshot.state).toBeNull();
    expect(snapshot.error).not.toBeNull();
  });
}

test('a request that never answers leaves the loading state', loadingStateBecomesTheLostConnection);

/**
 * A state that is newer than the one the client has is applied.
 */
test('a newer state is applied', function appliesNewer(): void {
  const store = createPlayerStateStore();
  store.getState().applySnapshot(buildPlayerStateFixture({ rev: FIXTURE_REV }));
  store.getState().applySnapshot(buildPlayerStateFixture({ rev: FIXTURE_REV + 1 }));
  expect(store.getState().rev).toBe(FIXTURE_REV + 1);
});

/**
 * A state that is not newer is ignored: a push that arrives late does not put
 * the client back in the past.
 */
test('a state that is not newer is ignored', function ignoresOlder(): void {
  const store = createPlayerStateStore();
  store.getState().applySnapshot(buildPlayerStateFixture({ rev: FIXTURE_REV }));
  store.getState().applySnapshot(buildPlayerStateFixture({ rev: FIXTURE_REV - 1 }));
  expect(store.getState().rev).toBe(FIXTURE_REV);
});

/**
 * A server that restarted has a counter that starts over: the state of the
 * new server is taken.
 */
test('a state of another epoch is taken', function takesResync(): void {
  const store = createPlayerStateStore();
  store.getState().applySnapshot(buildPlayerStateFixture({ rev: FIXTURE_REV }));
  store.getState().applySnapshot(buildPlayerStateFixture({ epoch: 'another-epoch', rev: 1 }));
  expect(store.getState().epoch).toBe('another-epoch');
  expect(store.getState().rev).toBe(1);
});
