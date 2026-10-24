import { beforeEach, expect, test } from 'bun:test';

import type {
  HuntCreatureActor,
  HuntDelta,
  HuntLedger,
  HuntSnapshot,
} from '@creatures/contracts/huntSim';

import { huntStore } from '~/entities/hunt';
import { buildHandlers } from '~/pages/play/model/gameChannelHandlers';
import type { ChannelState } from '~/pages/play/model/gameChannelHandlers';
import type { ChannelMachine } from '~/pages/play/model/gameChannelMachine';
import type { GameSocketHandlers } from '~/pages/play/model/gameSocket';

function buildActor(kind: HuntCreatureActor['kind'], id: string, hp = 20): HuntCreatureActor {
  return {
    dir: 'down',
    hp,
    id,
    kind,
    level: 1,
    maxHp: 30,
    speciesName: id,
    speciesSlug: id,
    tile: { x: 1, y: 1 },
  };
}

function buildLedger(kills = 0): HuntLedger {
  return { drops: [], encounters: 0, experience: 0, kills, spent: [] };
}

function buildSnapshot(huntRev: number): HuntSnapshot {
  return {
    abilities: [],
    consumables: [],
    device: null,
    huntRev,
    ledger: buildLedger(),
    player: buildActor('player', 'player-1'),
    serverNow: 1000,
    session: {
      areaName: 'Campina Cinzenta',
      areaSlug: 'campina-cinzenta',
      endsAt: 2000,
      id: 'hunt-1',
      startedAt: 500,
      status: 'active',
    },
    team: [],
    trainer: { dir: 'down', tile: { x: 1, y: 2 } },
    waves: [],
    wilds: [],
  };
}

function buildDelta(huntRev: number): HuntDelta {
  return {
    abilities: [],
    at: 100_000,
    consumables: [],
    events: [],
    huntRev,
    removed: [],
    upserts: [buildActor('player', 'player-1', 8)],
    waves: [],
  };
}

function buildMachine(): ChannelMachine {
  return {
    attempt: noop,
    cancelExpectedClose: noop,
    close: noop,
    expectServerClose: noop,
    reconnectNow: noop,
    requestCommand: refuseCommand,
    requestMove: refuseMove,
    retry: noop,
  };
}

function refuseCommand(): Promise<never> {
  return Promise.reject(new Error('the test does not command'));
}

function refuseMove(): Promise<never> {
  return Promise.reject(new Error('the test does not move'));
}

function buildChannelState(): ChannelState {
  return {
    attempt: { socket: null, suppressed: true },
    expectedClose: false,
    retries: 0,
    retryTimer: null,
    stabilityTimer: null,
    stableAttempt: null,
    stopped: true,
  };
}

function buildHuntHandlers(onHuntEnded: () => void): GameSocketHandlers {
  return buildHandlers(
    {
      applySnapshot: noop,
      onHuntEnded,
      onLost: noop,
      onOpen: noop,
      onWarning: noop,
    },
    buildChannelState(),
    { socket: null, suppressed: true },
    buildMachine(),
  );
}

function noop(): void {
  void 0;
}

beforeEach(function resetHunt(): void {
  huntStore.getState().resetHunt();
});

test('the hunt state reaches the store', function appliesSnapshot(): void {
  buildHuntHandlers(noop).onHuntState(buildSnapshot(4));
  const state = huntStore.getState();
  expect(state.phase).toBe('active');
  expect(state.huntRev).toBe(4);
  expect(state.snapshot?.player.id).toBe('player-1');
});

test('the hunt delta reaches the store', function appliesDelta(): void {
  const handlers = buildHuntHandlers(noop);
  handlers.onHuntState(buildSnapshot(4));
  handlers.onHuntDelta(buildDelta(5));
  const state = huntStore.getState();
  expect(state.huntRev).toBe(5);
  expect(state.snapshot?.player.hp).toBe(8);
});

test('the end of the hunt reaches the store and asks for the player state', function appliesEnded(): void {
  let ended = 0;
  const handlers = buildHuntHandlers(function onHuntEnded(): void {
    ended += 1;
  });
  handlers.onHuntState(buildSnapshot(4));
  handlers.onHuntEnded({ huntRev: 6, ledger: buildLedger(2), reason: 'player_finalized' });
  const state = huntStore.getState();
  expect(state.phase).toBe('leaving');
  expect(state.endReason).toBe('player_finalized');
  expect(state.snapshot?.ledger.kills).toBe(2);
  expect(ended).toBe(1);
});

test('the close of the channel forgets the hunt', function resetsOnClose(): void {
  const handlers = buildHuntHandlers(noop);
  handlers.onHuntState(buildSnapshot(4));
  handlers.onClose(1006);
  const state = huntStore.getState();
  expect(state.phase).toBe('idle');
  expect(state.snapshot).toBeNull();
  expect(state.huntRev).toBe(0);
});
