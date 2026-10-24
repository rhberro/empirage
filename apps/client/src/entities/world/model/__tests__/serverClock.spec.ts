import { expect, test } from 'bun:test';

import { createServerClock } from '~/entities/world/model/serverClock';

test('seeds the clock from a one-shot reading', function seedsClock(): void {
  const clock = createServerClock({ now: buildNow(1040) });
  clock.seed(1000);
  expect(clock.now()).toBe(1000);
  expect(clock.renderNow()).toBe(970);
});

test('derives the offset from the round trip of the pong', function readsPong(): void {
  const clock = createServerClock({ now: buildNow(40) });
  clock.observePong({ receivedAt: 40, sentAt: 0, serverNow: 1000 });
  expect(clock.rttMs()).toBe(40);
  expect(clock.now()).toBe(1020);
  expect(clock.bufferMs()).toBe(40);
  expect(clock.renderNow()).toBe(980);
});

test('keeps the lowest round trip when a slow answer arrives', function keepsBestRtt(): void {
  const clock = createServerClock({ now: buildNow(200) });
  clock.observePong({ receivedAt: 40, sentAt: 0, serverNow: 1000 });
  clock.observePong({ receivedAt: 200, sentAt: 0, serverNow: 1200 });
  expect(clock.rttMs()).toBe(40);
  expect(clock.now()).toBe(1180);
  expect(clock.jitterMs()).toBe(40);
  expect(clock.bufferMs()).toBe(120);
});

test('does not let a one-shot reading override a pong', function seedDoesNotOverride(): void {
  const clock = createServerClock({ now: buildNow(40) });
  clock.observePong({ receivedAt: 40, sentAt: 0, serverNow: 1000 });
  clock.seed(9999, 40);
  expect(clock.now()).toBe(1020);
});

test('forgets the samples of the window', function prunesSamples(): void {
  const clock = createServerClock({ now: buildNow(20_000) });
  clock.observePong({ receivedAt: 0, sentAt: 0, serverNow: 1000 });
  clock.observePong({ receivedAt: 20_000, sentAt: 20_000, serverNow: 21_000 });
  expect(clock.rttMs()).toBe(0);
  expect(clock.now()).toBe(21_000);
});

test('resets to the wall clock', function resetsClock(): void {
  const clock = createServerClock({ now: buildNow(500) });
  clock.observePong({ receivedAt: 500, sentAt: 400, serverNow: 900 });
  clock.reset();
  expect(clock.now()).toBe(500);
  expect(clock.rttMs()).toBe(0);
  expect(clock.bufferMs()).toBe(30);
});

test('slews the buffer instead of jumping', function slewsBuffer(): void {
  let wall = 0;
  function readWall(): number {
    return wall;
  }
  const clock = createServerClock({ now: readWall });
  clock.observePong({ receivedAt: 0, sentAt: 0, serverNow: 1000 });
  wall = 1000;
  clock.observePong({ receivedAt: 1000, sentAt: 0, serverNow: 2000 });
  expect(clock.bufferMs()).toBe(160);
  // The target is 160 ms, but the applied buffer only moved 60 ms in one
  // second: the render is at 1910, not at 1840.
  expect(clock.renderNow()).toBe(1910);
});

function buildNow(value: number): () => number {
  function fixedNow(): number {
    return value;
  }
  return fixedNow;
}
