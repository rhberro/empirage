import { expect, test } from 'bun:test';

import type {
  HuntCaptureDevice,
  HuntCreatureActor,
  HuntDelta,
  HuntLedger,
  HuntRuntimeEvent,
  HuntTeamMemberActor,
} from '@creatures/contracts/huntSim';

import { createHuntStore, selectDevice, selectTeam } from '~/entities/hunt';
import type { HuntSnapshot } from '~/entities/hunt';

const DEVICE: HuntCaptureDevice = {
  itemId: 'device-2',
  multiplier: 2,
  name: 'Bola Boa',
  quantity: 4,
  slot: 6,
};

const TEAM: HuntTeamMemberActor[] = [
  {
    fainted: false,
    id: 'creature-1',
    level: 3,
    speciesName: 'Folha',
    speciesSlug: 'folha',
    teamSlot: 1,
  },
  {
    fainted: true,
    id: 'creature-2',
    level: 1,
    speciesName: 'Brasa',
    speciesSlug: 'brasa',
    teamSlot: 2,
  },
];

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

function buildSnapshot(huntRev: number, wilds: HuntCreatureActor[] = []): HuntSnapshot {
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
    wilds,
  };
}

function buildDelta(
  huntRev: number,
  upserts: HuntCreatureActor[],
  removed: string[],
  events: HuntRuntimeEvent[] = [],
): HuntDelta {
  return {
    abilities: [],
    at: 100_000,
    consumables: [],
    events,
    huntRev,
    removed,
    upserts,
    waves: [],
  };
}

test('the first snapshot activates the hunt', function appliesSnapshot(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  const state = store.getState();
  expect(state.phase).toBe('active');
  expect(state.huntRev).toBe(4);
  expect(state.snapshot?.player.id).toBe('player-1');
});

test('an old snapshot is discarded after the first one', function discardsOldSnapshot(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  store.getState().applySnapshot(buildSnapshot(3));
  expect(store.getState().huntRev).toBe(4);
});

test('a delta with a newer revision is applied', function appliesDelta(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  store.getState().applyDelta(buildDelta(5, [buildActor('player', 'player-1', 7)], []));
  expect(store.getState().huntRev).toBe(5);
  expect(store.getState().snapshot?.player.hp).toBe(7);
});

test('a delta with the same or an older revision is discarded', function discardsOldDelta(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  store.getState().applyDelta(buildDelta(4, [buildActor('player', 'player-1', 7)], []));
  store.getState().applyDelta(buildDelta(3, [buildActor('player', 'player-1', 2)], []));
  expect(store.getState().huntRev).toBe(4);
  expect(store.getState().snapshot?.player.hp).toBe(20);
});

test('the delta merges the actors by id', function mergesActors(): void {
  const store = createHuntStore();
  store
    .getState()
    .applySnapshot(buildSnapshot(4, [buildActor('wild', 'wild-1'), buildActor('wild', 'wild-2')]));
  store
    .getState()
    .applyDelta(
      buildDelta(
        5,
        [
          buildActor('player', 'player-1', 9),
          buildActor('wild', 'wild-1', 3),
          buildActor('wild', 'wild-3'),
        ],
        ['wild-2'],
      ),
    );
  const state = store.getState();
  expect(state.snapshot?.player.hp).toBe(9);
  expect(state.snapshot?.wilds?.map(actorId)).toEqual(['wild-1', 'wild-3']);
  expect(state.snapshot?.wilds?.[0].hp).toBe(3);
});

test('the events of the window are kept and the old ones are dropped', function filtersEvents(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  const recent: HuntRuntimeEvent = { actorId: 'player-1', amount: 2, at: 99_000, type: 'heal' };
  const old: HuntRuntimeEvent = { actorId: 'player-1', amount: 2, at: 94_000, type: 'heal' };
  store.getState().applyDelta(buildDelta(5, [], [], [old, recent]));
  expect(store.getState().events).toEqual([recent]);
});

test('the end of the hunt keeps the final ledger for the exit', function appliesEnded(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  store.getState().applyEnded({
    huntRev: 6,
    ledger: buildLedger(3),
    reason: 'player_finalized',
  });
  const state = store.getState();
  expect(state.phase).toBe('leaving');
  expect(state.endReason).toBe('player_finalized');
  expect(state.snapshot?.ledger.kills).toBe(3);
  expect(state.huntRev).toBe(6);
});

test('the reset forgets the hunt', function resetsHunt(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  store.getState().resetHunt();
  const state = store.getState();
  expect(state.phase).toBe('idle');
  expect(state.snapshot).toBeNull();
  expect(state.huntRev).toBe(0);
  expect(state.events).toEqual([]);
});

test('entering the hunt waits for the snapshot', function beginsEntering(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  store.getState().beginEntering();
  const state = store.getState();
  expect(state.phase).toBe('entering');
  expect(state.snapshot).toBeNull();
  expect(state.error).toBeNull();
});

test('the error of the hunt is kept for the screen', function setsError(): void {
  const store = createHuntStore();
  store.getState().setError('Stamina insuficiente.');
  expect(store.getState().error).toBe('Stamina insuficiente.');
});

test('the delta applies the device and the team', function appliesDeviceAndTeam(): void {
  const store = createHuntStore();
  store.getState().applySnapshot(buildSnapshot(4));
  const delta = { ...buildDelta(5, [], []), device: DEVICE, team: TEAM };
  store.getState().applyDelta(delta);
  expect(selectDevice(store.getState())).toEqual(DEVICE);
  expect(selectTeam(store.getState())).toEqual(TEAM);
});

test('a delta without the device keeps the one of the snapshot', function keepsDevice(): void {
  const store = createHuntStore();
  const snapshot = { ...buildSnapshot(4), device: DEVICE, team: TEAM };
  store.getState().applySnapshot(snapshot);
  store.getState().applyDelta(buildDelta(5, [], []));
  expect(selectDevice(store.getState())).toEqual(DEVICE);
  expect(selectTeam(store.getState())).toEqual(TEAM);
});

test('a null device empties the slot', function clearsDevice(): void {
  const store = createHuntStore();
  const snapshot = { ...buildSnapshot(4), device: DEVICE };
  store.getState().applySnapshot(snapshot);
  const delta = { ...buildDelta(5, [], []), device: null };
  store.getState().applyDelta(delta);
  expect(selectDevice(store.getState())).toBeNull();
});

test('the city has no device and an empty team', function readsEmptyHunt(): void {
  const store = createHuntStore();
  expect(selectDevice(store.getState())).toBeNull();
  expect(selectTeam(store.getState())).toEqual([]);
});

function actorId(actor: HuntCreatureActor): string {
  return actor.id;
}
