import { expect, test } from 'bun:test';

import type {
  HuntAbilityCooldown,
  HuntConsumableSlot,
  HuntDelta,
  HuntSnapshot,
} from '@creatures/contracts/huntSim';

import { findRow } from './fakeHuntAdmin';
import type { FakeDatabase, FakeRow } from './fakeQuery';
import type { Harness } from './managerSupport';
import {
  buildHarness,
  CREATURE_ID,
  POTION_ID,
  START,
  startHunt,
  TRAINER_ID,
} from './managerSupport';

const TONIC_ID = 'tonic-item';
const IGNEA_ID = 'ability-ignea';
const PEDRA_ID = 'ability-pedra';
const IGNEA_COOLDOWN_MS = 7000;
const TONIC_COOLDOWN_MS = 3000;

function buildAbility(id: string, slug: string, name: string, cooldownMs: number): FakeRow {
  return {
    area_length: null,
    area_radius: null,
    area_shape: null,
    area_step_ms: 150,
    cooldown_ms: cooldownMs,
    damage: 10,
    element: 'fire',
    id,
    name,
    range: 5,
    slug,
    target_type: 'target',
    travel_ms: 0,
  };
}

function addAbility(
  harness: Harness,
  slot: number,
  id: string,
  slug: string,
  name: string,
  cooldownMs: number,
): void {
  const rows = harness.db.rows.get('creature_ability_slots') ?? [];
  rows.push({
    abilities: buildAbility(id, slug, name, cooldownMs),
    creature_id: CREATURE_ID,
    slot,
  });
  harness.db.rows.set('creature_ability_slots', rows);
}

function removeAbility(harness: Harness, slot: number): void {
  const rows = harness.db.rows.get('creature_ability_slots') ?? [];
  harness.db.rows.set(
    'creature_ability_slots',
    rows.filter(function keeps(row: FakeRow): boolean {
      return row.slot !== slot;
    }),
  );
}

function buildTonic(): FakeRow {
  return {
    cooldown_ms: TONIC_COOLDOWN_MS,
    heal_percent: 30,
    id: TONIC_ID,
    name: 'Tônico',
  };
}

function addItem(db: FakeDatabase, itemId: string, quantity: number): void {
  const rows = db.rows.get('trainer_items') ?? [];
  rows.push({ item_id: itemId, quantity, trainer_id: TRAINER_ID });
  db.rows.set('trainer_items', rows);
}

function readLastDelta(harness: Harness): HuntDelta {
  const delta = harness.deltas.at(-1);
  if (delta === undefined) {
    throw new Error('the refresh did not publish a delta');
  }
  return delta;
}

function abilityAt(delta: HuntDelta, slot: number): HuntAbilityCooldown | undefined {
  return (delta.abilities ?? []).find(function matches(ability): boolean {
    return ability.slot === slot;
  });
}

function consumableAt(delta: HuntDelta, slot: number): HuntConsumableSlot | undefined {
  return (delta.consumables ?? []).find(function matches(consumable): boolean {
    return consumable.slot === slot;
  });
}

function removesAnAbilityFromTheMiddle(): Promise<void> {
  const harness = buildHarness();
  addAbility(harness, 1, IGNEA_ID, 'ignea', 'Ígnea', IGNEA_COOLDOWN_MS);
  addAbility(harness, 2, PEDRA_ID, 'pedra', 'Pedra', 9000);
  return startHunt(harness).then(function withHunt(): Promise<void> {
    removeAbility(harness, 1);
    return harness.manager.refreshLoadout(TRAINER_ID).then(function assert(): Promise<void> {
      const delta = readLastDelta(harness);
      expect(
        (delta.abilities ?? []).map(function readSlot(ability): number {
          return ability.slot;
        }),
      ).toEqual([0, 2]);
      return harness.manager.snapshot(TRAINER_ID).then(function checkSnapshot(
        snapshot: HuntSnapshot | null,
      ): void {
        expect(snapshot?.abilities.map(readSlotOf)).toEqual([0, 2]);
      });
    });
  });
}

function newAbilityEntersInCooldown(): Promise<void> {
  const harness = buildHarness();
  return startHunt(harness).then(function withHunt(): Promise<void> {
    harness.advanceClock(10_000);
    addAbility(harness, 1, IGNEA_ID, 'ignea', 'Ígnea', IGNEA_COOLDOWN_MS);
    return harness.manager.refreshLoadout(TRAINER_ID).then(function assert(): void {
      const delta = readLastDelta(harness);
      expect(abilityAt(delta, 0)?.readyAt).toBe(START);
      expect(abilityAt(delta, 0)?.abilitySlug).toBe('brasa');
      expect(abilityAt(delta, 1)?.readyAt).toBe(START + 10_000 + IGNEA_COOLDOWN_MS);
      expect(abilityAt(delta, 1)?.abilitySlug).toBe('ignea');
    });
  });
}

function swapsTheConsumableAndKeepsTheReadyAtOnTriggerChange(): Promise<void> {
  const harness = buildHarness({
    trainerItems: [{ item_id: POTION_ID, quantity: 3, trainer_id: TRAINER_ID }],
  });
  return startHunt(harness).then(function withHunt(): Promise<void> {
    harness.advanceClock(5000);
    replaceGearWithTonic(harness);
    addItem(harness.db, TONIC_ID, 4);
    return harness.manager
      .refreshLoadout(TRAINER_ID)
      .then(function afterSwap(): Promise<void> {
        const swapped = consumableAt(readLastDelta(harness), 4);
        expect(swapped?.itemId).toBe(TONIC_ID);
        expect(swapped?.quantity).toBe(4);
        expect(swapped?.readyAt).toBe(START + 5000 + TONIC_COOLDOWN_MS);
        harness.advanceClock(1000);
        setTrigger(harness, 20);
        return harness.manager.refreshLoadout(TRAINER_ID);
      })
      .then(function afterTrigger(): void {
        const triggered = consumableAt(readLastDelta(harness), 4);
        expect(triggered?.triggerHpPercent).toBe(20);
        expect(triggered?.readyAt).toBe(START + 5000 + TONIC_COOLDOWN_MS);
      });
  });
}

function updatesTheConsumableQuantity(): Promise<void> {
  const harness = buildHarness({
    trainerItems: [{ item_id: POTION_ID, quantity: 3, trainer_id: TRAINER_ID }],
  });
  return startHunt(harness).then(function withHunt(): Promise<void> {
    harness.advanceClock(5000);
    const row = findRow(harness.db, 'trainer_items', 'item_id', POTION_ID);
    if (row === undefined) {
      throw new Error('the potion of the fixture was not found');
    }
    row.quantity = 8;
    return harness.manager.refreshLoadout(TRAINER_ID).then(function assert(): void {
      const consumable = consumableAt(readLastDelta(harness), 4);
      expect(consumable?.quantity).toBe(8);
      expect(consumable?.readyAt).toBe(START);
    });
  });
}

function removesTheConsumableOfAClearedSlot(): Promise<void> {
  const harness = buildHarness({
    trainerItems: [{ item_id: POTION_ID, quantity: 3, trainer_id: TRAINER_ID }],
  });
  return startHunt(harness).then(function withHunt(): Promise<void> {
    const rows = harness.db.rows.get('trainer_gear_slots') ?? [];
    harness.db.rows.set('trainer_gear_slots', []);
    expect(rows.length).toBe(1);
    return harness.manager.refreshLoadout(TRAINER_ID).then(function assert(): void {
      expect(readLastDelta(harness).consumables).toEqual([]);
    });
  });
}

function replaceGearWithTonic(harness: Harness): void {
  const row = findRow(harness.db, 'trainer_gear_slots', 'slot', 4);
  if (row === undefined) {
    throw new Error('the consumable slot of the fixture was not found');
  }
  row.item_id = TONIC_ID;
  row.items = buildTonic();
}

function setTrigger(harness: Harness, triggerHpPercent: number): void {
  const row = findRow(harness.db, 'trainer_gear_slots', 'slot', 4);
  if (row === undefined) {
    throw new Error('the consumable slot of the fixture was not found');
  }
  row.trigger_hp_percent = triggerHpPercent;
}

function readSlotOf(ability: HuntAbilityCooldown): number {
  return ability.slot;
}

test(
  'refreshLoadout removes an ability from the middle of the hunt',
  removesAnAbilityFromTheMiddle,
);
test('a new ability enters in cooldown and the kept one keeps its own', newAbilityEntersInCooldown);
test(
  'swapping the consumable resets the cooldown and a trigger change keeps it',
  swapsTheConsumableAndKeepsTheReadyAtOnTriggerChange,
);
test('refreshLoadout updates the consumable quantity', updatesTheConsumableQuantity);
test('refreshLoadout removes the consumable of a cleared slot', removesTheConsumableOfAClearedSlot);
