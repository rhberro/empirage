import { expect, test } from 'bun:test';

import type { PlayerState } from '@creatures/contracts/player';
import type { EquippedAbility, EquippedConsumable } from '@creatures/contracts/skill';

import { buildPlayerStateFixture } from '~/entities/team';
import {
  applyPending,
  isTriggerConfirmed,
  matchesPending,
  predictAbilityEquip,
  predictConsumableEquip,
  predictDeviceEquip,
  predictTrigger,
  readLoadout,
} from '~/features/skill-panel/model/skillPanelPrediction';

const BRASA_ID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const IGNEA_ID = 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const GARRA_ID = 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f';
const POCAO_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const PRISMA_ID = '4e5f6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8b';

function buildEquippedAbility(abilityId: string, slot: number): EquippedAbility {
  return {
    abilityId,
    cooldownMs: 4000,
    damage: 10,
    element: 'fire',
    name: 'Brasa',
    slot: slot as EquippedAbility['slot'],
    slug: 'brasa',
  };
}

function buildEquippedConsumable(itemId: string, slot: number): EquippedConsumable {
  return {
    itemId,
    name: 'Poção de Cura',
    quantity: 3,
    slot: slot as EquippedConsumable['slot'],
    triggerHpPercent: 30,
  };
}

function buildState(): PlayerState {
  return buildPlayerStateFixture({
    activeAbilities: buildAbilities(),
    activeCreatureId: 'creature-1',
    activeVitals: { currentHp: 12, maxHp: 24 },
    backpack: buildBackpack(),
    equippedAbilities: [
      buildEquippedAbility(BRASA_ID, 0),
      buildEquippedAbility(IGNEA_ID, 1),
      buildEquippedAbility(GARRA_ID, 2),
    ],
  });
}

function buildAbilities(): PlayerState['activeAbilities'] {
  return [
    {
      abilityId: BRASA_ID,
      cooldownMs: 4000,
      damage: 12,
      element: 'fire',
      name: 'Brasa',
      slot: 0,
      slug: 'brasa',
    },
    {
      abilityId: IGNEA_ID,
      cooldownMs: 7000,
      damage: 24,
      element: 'fire',
      name: 'Ígnea',
      slot: 1,
      slug: 'ignea',
    },
    {
      abilityId: GARRA_ID,
      cooldownMs: 2000,
      damage: 8,
      element: 'neutral',
      name: 'Garra',
      slot: 2,
      slug: 'garra',
    },
  ];
}

function buildBackpack(): PlayerState['backpack'] {
  return [
    {
      category: 'consumable',
      description: 'Restaura a vida de uma criatura.',
      isStoreItem: true,
      itemId: POCAO_ID,
      name: 'Poção de Cura',
      price: 120,
      quantity: 93,
      slug: 'pocao-de-cura',
    },
  ];
}

/**
 * The ability that is chosen goes to the slot, and the slot it came from is
 * emptied: the same ability cannot take two slots.
 */
function predictsTheAbilityInTheSlot(): void {
  const pending = predictAbilityEquip(readLoadout(buildState()), buildState(), 3, BRASA_ID);
  const inSlot = pending.abilities.find(function matches(entry: EquippedAbility): boolean {
    return entry.slot === 3;
  });
  expect(inSlot?.abilityId).toBe(BRASA_ID);
  expect(pending.abilities.length).toBe(3);
  expect(
    pending.abilities.some(function matches(entry: EquippedAbility): boolean {
      return entry.abilityId === BRASA_ID && entry.slot !== 3;
    }),
  ).toBe(false);
}

test('the chosen ability goes to the slot at once', predictsTheAbilityInTheSlot);

/**
 * The ability that is clicked again leaves its slot.
 */
function predictsTheEmptySlot(): void {
  const pending = predictAbilityEquip(readLoadout(buildState()), buildState(), 0, BRASA_ID);
  expect(
    pending.abilities.some(function matches(entry: EquippedAbility): boolean {
      return entry.slot === 0;
    }),
  ).toBe(false);
}

test('the ability that is clicked again leaves its slot', predictsTheEmptySlot);

/**
 * The consumable that is chosen goes to the slot with the life that triggers
 * it.
 */
function predictsTheConsumableInTheSlot(): void {
  const pending = predictConsumableEquip(readLoadout(buildState()), buildState(), 4, POCAO_ID, 45);
  const inSlot = pending.consumables.find(function matches(entry: EquippedConsumable): boolean {
    return entry.slot === 4;
  });
  expect(inSlot?.itemId).toBe(POCAO_ID);
  expect(inSlot?.triggerHpPercent).toBe(45);
}

test('the chosen consumable goes to the slot with its trigger', predictsTheConsumableInTheSlot);

/**
 * The device that is chosen goes to the device slot.
 */
function predictsTheDeviceInTheSlot(): void {
  const pending = predictDeviceEquip(readLoadout(buildState()), buildState(), PRISMA_ID);
  expect(pending.device?.itemId).toBe(PRISMA_ID);
  expect(pending.device?.slot).toBe(6);
}

test('the chosen device goes to the device slot', predictsTheDeviceInTheSlot);

/**
 * The life of the trigger moves the consumable of the slot.
 */
function predictsTheMovedTrigger(): void {
  const state = buildState();
  state.equippedConsumables = [buildEquippedConsumable(POCAO_ID, 4)];
  const pending = predictTrigger(readLoadout(state), 4, 60);
  expect(pending.consumables[0]?.triggerHpPercent).toBe(60);
}

test('the life of the trigger moves with the consumable', predictsTheMovedTrigger);

/**
 * The state of the server confirms the change the client predicted.
 */
function confirmsThePredictedChange(): void {
  const state = buildState();
  const pending = predictAbilityEquip(readLoadout(state), state, 3, BRASA_ID);
  expect(matchesPending(state, pending)).toBe(false);
  const confirmed = applyPending(state, pending);
  expect(confirmed).not.toBeNull();
  expect(matchesPending(confirmed, pending)).toBe(true);
}

test('the state of the server confirms the predicted change', confirmsThePredictedChange);

/**
 * The life of the trigger is confirmed when the server carries it.
 */
function confirmsTheTrigger(): void {
  const state = buildState();
  state.equippedConsumables = [buildEquippedConsumable(POCAO_ID, 4)];
  expect(isTriggerConfirmed(state, 4, 30)).toBe(true);
  expect(isTriggerConfirmed(state, 4, 45)).toBe(false);
  expect(isTriggerConfirmed(state, 5, 30)).toBe(false);
}

test('the life of the trigger is confirmed by the server', confirmsTheTrigger);
