import { expect, test } from 'bun:test';

import type { HuntDelta } from '@creatures/contracts/huntSim';

import { buildWild, buildTeamMember, START } from '~/__tests__/hunt/sim/fixtures';
import type { SimState, SimTeamMemberInput } from '~/hunt/sim';
import { activeCreature } from '~/hunt/sim';

import { findRow } from './fakeHuntAdmin';
import type { Field, Harness } from './managerSupport';
import {
  buildField,
  buildHarness,
  buildSessionRow,
  CREATURE_ID,
  hydrateStoredState,
  POTION_ID,
  readCreatureHp,
  seedCreatureHp,
  TRAINER_ID,
} from './managerSupport';

function resumesTheStoredState(): Promise<void> {
  const harness = buildHarness({ creatures: [] });
  return buildField(harness)
    .then(function withField(field: Field): Promise<void> {
      field.state.ledger.kills = 7;
      harness.db.rows.set('hunt_sessions', [buildSessionRow(field.state)]);
      return hydrateStoredState(harness);
    })
    .then(function assert(): Promise<void> {
      expect(harness.manager.has(TRAINER_ID)).toBe(true);
      return harness.manager.snapshot(TRAINER_ID).then(function withSnapshot(snapshot): void {
        expect(snapshot?.session.id).toBe('session-1');
        expect(snapshot?.ledger.kills).toBe(7);
      });
    });
}

function createsTheStateOfAnOldSession(): Promise<void> {
  const harness = buildHarness();
  return buildField(harness)
    .then(function withField(field: Field): Promise<void> {
      harness.db.rows.set('hunt_sessions', [
        buildSessionRow(field.state, { simulation_state: null }),
      ]);
      return hydrateStoredState(harness);
    })
    .then(function assert(): Promise<void> {
      expect(harness.manager.has(TRAINER_ID)).toBe(true);
      return harness.manager.snapshot(TRAINER_ID).then(function withSnapshot(snapshot): void {
        expect(snapshot?.ledger.kills).toBe(0);
        expect(snapshot?.player.speciesSlug).toBe('brasa');
      });
    });
}

function spendsTheConsumable(): Promise<void> {
  const harness = buildHarness();
  const team = [buildTeamMember(buildConsumableOptions())];
  return buildField(harness, team)
    .then(function withField(field: Field): Promise<void> {
      const state = prepareQuietField(field.state);
      const active = activeCreature(state);
      active.hp = 5;
      harness.db.rows.set('trainer_items', [
        { item_id: POTION_ID, quantity: 3, trainer_id: TRAINER_ID },
      ]);
      harness.db.rows.set('hunt_sessions', [buildSessionRow(state)]);
      return hydrateStoredState(harness);
    })
    .then(function advance(): Promise<HuntDelta | null> {
      harness.advanceClock(1000);
      return harness.manager.advance(TRAINER_ID);
    })
    .then(function assert(delta: HuntDelta | null): Promise<void> {
      expect(delta?.events.some(isConsumable)).toBe(true);
      expect(readPotionQuantity(harness)).toBe(2);
      harness.advanceClock(5000);
      return harness.manager.advance(TRAINER_ID).then(function afterSecond(): void {
        expect(readPotionQuantity(harness)).toBe(2);
      });
    });
}

function closesWithoutAViableCreature(): Promise<void> {
  const harness = buildHarness();
  seedCreatureHp(harness, CREATURE_ID, 1);
  return buildField(harness)
    .then(function withField(field: Field): Promise<void> {
      const state = prepareQuietField(field.state);
      const active = activeCreature(state);
      active.hp = 1;
      const wildTile = { x: active.tile.x + 1, y: active.tile.y };
      const wild = buildWild(field.content, wildTile, 'brasa', 'wild-1');
      wild.meleeReadyAt = START;
      wild.nextDecisionAt = START;
      wild.spawnIndex = 0;
      wild.spawnTile = wildTile;
      state.wilds = [wild];
      state.spawns = [{ index: 0, respawnAt: null, wildId: 'wild-1' }];
      harness.db.rows.set('hunt_sessions', [buildSessionRow(state)]);
      return hydrateStoredState(harness);
    })
    .then(function advance(): Promise<HuntDelta | null> {
      harness.advanceClock(1000);
      return harness.manager.advance(TRAINER_ID);
    })
    .then(function assert(): void {
      expect(harness.manager.has(TRAINER_ID)).toBe(false);
      expect(harness.ended.length).toBe(1);
      expect(harness.ended[0]?.reason).toBe('no_viable_creature');
      expect(readCreatureHp(harness, CREATURE_ID)).toBeNull();
      const session = findRow(harness.db, 'hunt_sessions', 'id', 'session-1');
      expect(session?.status).toBe('finished');
      expect(session?.end_reason).toBe('no_viable_creature');
    });
}

function buildConsumableOptions(): Pick<SimTeamMemberInput, 'abilities' | 'consumables'> {
  return {
    abilities: [null, null, null, null],
    consumables: [
      {
        cooldownMs: 2000,
        healPercent: 50,
        itemId: POTION_ID,
        name: 'Poção',
        quantity: 3,
        slot: 4,
        triggerHpPercent: 50,
      },
    ],
  };
}

function prepareQuietField(state: SimState): SimState {
  state.wilds = [];
  state.spawns = [];
  return state;
}

function isConsumable(event: { type: string }): boolean {
  return event.type === 'consumable_used';
}

function readPotionQuantity(harness: Harness): number {
  const row = findRow(harness.db, 'trainer_items', 'item_id', POTION_ID);
  return typeof row?.quantity === 'number' ? row.quantity : 0;
}

test('resumes the stored state', resumesTheStoredState);
test('creates the state of an old session', createsTheStateOfAnOldSession);
test('spends the consumable', spendsTheConsumable);
test('closes without a viable creature', closesWithoutAViableCreature);
