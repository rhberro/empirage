import { expect, test } from 'bun:test';

import {
  ABILITY_A,
  ABILITY_B,
  buildContent,
  buildState,
  buildTeamMember,
  LINE_ABILITY,
  START,
} from '~/__tests__/hunt/sim/fixtures';
import type { HuntRuntime } from '~/hunt/runtime/types';
import type { HuntSnapshotWire } from '~/hunt/runtime/wire';
import {
  toAbilityCooldowns,
  toConsumables,
  toCreatureActor,
  toDelta,
  toSnapshot,
  toTrainerActor,
} from '~/hunt/runtime/wire';
import type { SimState, SimWave } from '~/hunt/sim';
import { activeCreature } from '~/hunt/sim';

function buildRuntime(state: SimState, overrides?: Partial<HuntRuntime>): HuntRuntime {
  return {
    accountId: 'account-1',
    areaId: 'area-1',
    areaName: 'Test Meadow',
    areaSlug: 'test-area',
    checkpointing: false,
    content: buildContent(),
    credited: { drops: {}, spent: {} },
    delivered: {
      abilities: '',
      actors: new Map<string, string>(),
      consumables: '',
      device: '',
      ledger: '',
      team: '',
      trainer: '',
      waves: '',
    },
    dirty: false,
    endsAt: state.endsAt,
    huntRev: 2,
    lastCheckpointAt: START,
    lastWildIds: [],
    pendingCheckpoint: null,
    sessionId: 'session-1',
    sideEffects: Promise.resolve(),
    staminaAtStart: 480,
    startedAt: START,
    state,
    trainerId: 'trainer-1',
    version: 0,
    windowEndReason: 'offline_session_expired',
    ...overrides,
  };
}

function buildStateWithKit(): SimState {
  const state = buildState({
    team: [
      buildTeamMember({
        abilities: [ABILITY_A, null, ABILITY_B, null],
        consumables: [
          {
            cooldownMs: 2000,
            healPercent: 50,
            itemId: 'potion',
            name: 'Poção',
            quantity: 2,
            slot: 4,
            triggerHpPercent: 40,
          },
        ],
      }),
    ],
  });
  state.ledger.drops = [{ itemId: 'ember', name: 'Ember', quantity: 2 }];
  state.ledger.encounters = 1;
  state.ledger.experience = 100;
  state.ledger.kills = 1;
  state.ledger.spent = [{ itemId: 'potion', name: 'Poção', quantity: 1 }];
  state.device = { itemId: 'prisma', multiplier: 2, name: 'Prisma', quantity: 3, slot: 6 };
  state.waves = [buildWave()];
  return state;
}

function buildWave(): SimWave {
  return {
    ability: LINE_ABILITY,
    abilitySlug: 'line',
    attacker: {
      attributes: {
        magicAttack: 10,
        magicDefense: 5,
        physicalAttack: 5,
        physicalDefense: 5,
        vitality: 10,
      },
      level: 1,
    },
    casterId: 'creature-1',
    casterKind: 'player',
    element: 'fire',
    hitIds: [],
    id: '0',
    startedAt: START,
    tiles: [{ arrivalAt: START + 200, tile: { x: 6, y: 6 } }],
  };
}

function mapsTheSnapshot(): void {
  const state = buildStateWithKit();
  const runtime = buildRuntime(state);
  const snapshot = toSnapshot(runtime, START + 500) as HuntSnapshotWire;
  expect(snapshot.session).toEqual({
    areaName: 'Test Meadow',
    areaSlug: 'test-area',
    endsAt: state.endsAt,
    id: 'session-1',
    startedAt: START,
    status: 'active',
  });
  expect(snapshot.huntRev).toBe(2);
  expect(snapshot.serverNow).toBe(START + 500);
  expect(snapshot.player.id).toBe(state.activeCreatureId);
  expect(snapshot.player.speciesName).toBe('Brasa');
  expect(snapshot.device).toEqual({
    itemId: 'prisma',
    multiplier: 2,
    name: 'Prisma',
    quantity: 3,
    slot: 6,
  });
  expect(snapshot.team).toEqual([
    {
      fainted: false,
      id: 'creature-1',
      level: 1,
      speciesName: 'Brasa',
      speciesSlug: 'brasa',
      teamSlot: 1,
    },
  ]);
  expect(snapshot.wilds?.length).toBe(2);
  expect(snapshot.waves).toEqual([
    {
      abilitySlug: 'line',
      element: 'fire',
      id: '0',
      startedAt: START,
      tiles: [{ arrivalAt: START + 200, tile: { x: 6, y: 6 } }],
    },
  ]);
  expect(snapshot.ledger.kills).toBe(1);
  expect(snapshot.ledger.drops).toEqual([{ itemId: 'ember', name: 'Ember', quantity: 2 }]);
}

function mapsTheCooldowns(): void {
  const state = buildStateWithKit();
  const active = activeCreature(state);
  expect(toAbilityCooldowns(active)).toEqual([
    { abilitySlug: 'a', cooldownMs: 4000, element: 'neutral', name: 'A', readyAt: START, slot: 0 },
    { abilitySlug: 'b', cooldownMs: 2000, element: 'neutral', name: 'B', readyAt: START, slot: 2 },
  ]);
  expect(toConsumables(active)).toEqual([
    {
      itemId: 'potion',
      name: 'Poção',
      quantity: 2,
      readyAt: START,
      slot: 4,
      triggerHpPercent: 40,
    },
  ]);
}

function mapsTheActors(): void {
  const state = buildStateWithKit();
  const runtime = buildRuntime(state);
  const wild = state.wilds[0];
  if (wild === undefined) {
    throw new Error('the fixture has no wild');
  }
  wild.behavior = 'chase';
  wild.targetId = state.activeCreatureId;
  const actor = toCreatureActor(runtime, wild);
  expect(actor.behavior).toBe('chasing');
  expect(actor.targetId).toBe(state.activeCreatureId);
  expect(actor.speciesSlug).toBe('brasa');
  expect(toTrainerActor(state.trainer)).toEqual({
    dir: state.trainer.dir,
    tile: { x: state.trainer.tile.x, y: state.trainer.tile.y },
  });
}

function mapsTheNextStep(): void {
  const state = buildStateWithKit();
  const runtime = buildRuntime(state);
  const active = activeCreature(state);
  const wild = state.wilds[0];
  if (wild === undefined) {
    throw new Error('the fixture has no wild');
  }
  const playerSegment = {
    dir: 'right' as const,
    endsAt: START + 300,
    from: { x: 5, y: 5 },
    startsAt: START,
    to: { x: 6, y: 5 },
  };
  const wildSegment = {
    dir: 'left' as const,
    endsAt: START + 300,
    from: { x: 8, y: 7 },
    startsAt: START,
    to: { x: 7, y: 7 },
  };
  const trainerSegment = {
    dir: 'up' as const,
    endsAt: START + 400,
    from: { x: 5, y: 8 },
    startsAt: START,
    to: { x: 5, y: 7 },
  };

  active.segment = playerSegment;
  wild.segment = wildSegment;
  wild.nextDecisionAt = START + 900;
  state.trainer.segment = trainerSegment;

  expect(toCreatureActor(runtime, active).segment).toEqual(playerSegment);
  expect(toCreatureActor(runtime, wild).segment).toEqual(wildSegment);
  expect(toTrainerActor(state.trainer).segment).toEqual(trainerSegment);

  active.segment = undefined;
  wild.segment = undefined;
  state.trainer.segment = undefined;

  expect(toCreatureActor(runtime, active).segment).toBeUndefined();
  expect(toCreatureActor(runtime, wild).segment).toBeUndefined();
  expect(toTrainerActor(state.trainer).segment).toBeUndefined();
}

function mapsTheDelta(): void {
  const state = buildStateWithKit();
  const runtime = buildRuntime(state, { huntRev: 3 });
  const events = [
    {
      actorId: state.activeCreatureId,
      at: START,
      from: { x: 5, y: 5 },
      to: { x: 6, y: 5 },
      type: 'step' as const,
    },
  ];
  const delta = toDelta(runtime, events, ['wild-gone'], START + 100);
  expect(delta.at).toBe(START + 100);
  expect(delta.huntRev).toBe(3);
  expect(delta.events).toEqual(events);
  expect(delta.removed).toEqual(['wild-gone']);
  expect(delta.upserts.map(readId)).toContain(state.activeCreatureId);
  expect(delta.upserts.length).toBe(3);
  expect(delta.trainer?.tile).toEqual(state.trainer.tile);
  expect(delta.waves?.length).toBe(1);
  expect(delta.abilities?.length).toBe(2);
  expect(delta.consumables?.length).toBe(1);
  expect(delta.device?.quantity).toBe(3);
  expect(delta.team?.length).toBe(1);
  expect(delta.ledger?.kills).toBe(1);
}

function readId(actor: { id: string }): string {
  return actor.id;
}

test('maps the snapshot', mapsTheSnapshot);
test('maps the cooldowns', mapsTheCooldowns);
test('maps the actors', mapsTheActors);
test('maps the next step', mapsTheNextStep);
test('maps the delta', mapsTheDelta);
