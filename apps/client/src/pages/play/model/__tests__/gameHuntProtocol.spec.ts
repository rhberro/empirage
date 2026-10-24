import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type {
  HuntCreatureActor,
  HuntDelta,
  HuntEndedMessage,
  HuntLedger,
  HuntRuntimeEvent,
  HuntSnapshot,
} from '@creatures/contracts/huntSim';

import { parseServerMessage } from '~/pages/play/model/gameProtocol';

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

function buildLedger(): HuntLedger {
  return { drops: [], encounters: 0, experience: 0, kills: 1, spent: [] };
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
    events: [
      {
        actorId: 'player-1',
        amount: 5,
        at: 99_000,
        element: 'fire',
        targetId: 'wild-1',
        type: 'damage',
      },
    ],
    huntRev,
    removed: ['wild-2'],
    upserts: [buildActor('player', 'player-1', 10)],
    waves: [],
  };
}

function buildEnded(huntRev: number): HuntEndedMessage {
  return { huntRev, ledger: buildLedger(), reason: 'player_finalized' };
}

test('the hunt state is read', function readsHuntState(): void {
  const parsed = parseServerMessage(
    JSON.stringify({ ...buildSnapshot(4), type: 'hunt_state', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'hunt_state') {
    return;
  }
  expect(parsed.message.snapshot.huntRev).toBe(4);
  expect(parsed.message.snapshot.player.id).toBe('player-1');
  expect(parsed.message.snapshot.session.areaName).toBe('Campina Cinzenta');
});

test('the wilds of the hunt state are read when the server sends them', function readsWilds(): void {
  const snapshot = { ...buildSnapshot(4), wilds: [buildActor('wild', 'wild-1')] };
  const parsed = parseServerMessage(
    JSON.stringify({ ...snapshot, type: 'hunt_state', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'hunt_state') {
    return;
  }
  expect(parsed.message.snapshot.wilds).toHaveLength(1);
  expect(parsed.message.snapshot.wilds?.[0].id).toBe('wild-1');
});

test('the device and the team of the hunt state are read', function readsDeviceAndTeam(): void {
  const snapshot = {
    ...buildSnapshot(4),
    device: { itemId: 'device-2', multiplier: 2, name: 'Bola Boa', quantity: 4, slot: 6 },
    team: [
      {
        fainted: true,
        id: 'creature-1',
        level: 3,
        speciesName: 'Folha',
        speciesSlug: 'folha',
        teamSlot: 1,
      },
    ],
  };
  const parsed = parseServerMessage(
    JSON.stringify({ ...snapshot, type: 'hunt_state', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'hunt_state') {
    return;
  }
  expect(parsed.message.snapshot.device?.multiplier).toBe(2);
  expect(parsed.message.snapshot.team[0].fainted).toBe(true);
});

test('the device and the team of the delta are read when they come', function readsDeltaDevice(): void {
  const delta = {
    ...buildDelta(5),
    device: null,
    team: [
      {
        fainted: false,
        id: 'creature-1',
        level: 2,
        speciesName: 'x',
        speciesSlug: 'x',
        teamSlot: 1,
      },
    ],
  };
  const parsed = parseServerMessage(
    JSON.stringify({ ...delta, type: 'hunt_delta', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'hunt_delta') {
    return;
  }
  expect(parsed.message.delta.device).toBeNull();
  expect(parsed.message.delta.team?.[0].level).toBe(2);
});

test('the capture and the level-up events are read', function readsCaptureEvent(): void {
  const events = [
    {
      actorId: 'wild-1',
      at: 99_000,
      deviceItemId: 'device-1',
      speciesSlug: 'folha',
      success: true,
      type: 'capture',
    },
    { actorId: 'player-1', at: 99_100, level: 2, type: 'level_up' },
  ];
  const delta = { ...buildDelta(5), events };
  const parsed = parseServerMessage(
    JSON.stringify({ ...delta, type: 'hunt_delta', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'hunt_delta') {
    return;
  }
  expect(parsed.message.delta.events.map(readEventType)).toEqual(['capture', 'level_up']);
});

test('the hunt delta is read', function readsHuntDelta(): void {
  const parsed = parseServerMessage(
    JSON.stringify({ ...buildDelta(5), type: 'hunt_delta', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'hunt_delta') {
    return;
  }
  expect(parsed.message.delta.huntRev).toBe(5);
  expect(parsed.message.delta.events).toHaveLength(1);
  expect(parsed.message.delta.upserts[0].hp).toBe(10);
  expect(parsed.message.delta.removed).toEqual(['wild-2']);
});

test('the end of the hunt is read', function readsHuntEnded(): void {
  const parsed = parseServerMessage(
    JSON.stringify({ ...buildEnded(6), type: 'hunt_ended', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.message.kind !== 'hunt_ended') {
    return;
  }
  expect(parsed.message.ended.reason).toBe('player_finalized');
  expect(parsed.message.ended.ledger.kills).toBe(1);
});

test('a hunt state with a broken player is refused', function refusesBrokenState(): void {
  const snapshot = {
    ...buildSnapshot(4),
    player: { ...buildActor('player', 'player-1'), hp: '5' },
  };
  const parsed = parseServerMessage(
    JSON.stringify({ ...snapshot, type: 'hunt_state', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    return;
  }
  expect(parsed.failure).toBe('malformed');
});

test('a hunt delta without an events array is refused', function refusesBrokenDelta(): void {
  const delta = { ...buildDelta(5), events: 'none' };
  const parsed = parseServerMessage(
    JSON.stringify({ ...delta, type: 'hunt_delta', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    return;
  }
  expect(parsed.failure).toBe('malformed');
});

function readEventType(event: HuntRuntimeEvent): string {
  return event.type;
}

test('a hunt with an unknown end reason is refused', function refusesBrokenEnded(): void {
  const ended = { ...buildEnded(6), reason: 'unknown' };
  const parsed = parseServerMessage(
    JSON.stringify({ ...ended, type: 'hunt_ended', v: PROTOCOL_VERSION }),
  );
  expect(parsed.ok).toBe(false);
  if (parsed.ok) {
    return;
  }
  expect(parsed.failure).toBe('malformed');
});
