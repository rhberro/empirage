import { expect, test } from 'bun:test';

import type { PlayerState } from '@creatures/contracts/player';
import type { EquippedAbility, SkillSlot } from '@creatures/contracts/skill';

import { buildPlayerStateFixture } from '~/entities/team';
import {
  planAbilityChoice,
  planConsumableChoice,
  planDeviceChoice,
  planTriggerChoice,
} from '~/features/skill-panel/model/skillPanelChoice';
import type { PendingLoadout } from '~/features/skill-panel/model/skillPanelPrediction';
import { readLoadout } from '~/features/skill-panel/model/skillPanelPrediction';
import { appendCommand, readPendingLoadout } from '~/features/skill-panel/model/skillPanelQueue';

const BRASA_ID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const IGNEA_ID = 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const GARRA_ID = 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f';
const POCAO_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const PRISMA_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';

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

function buildState(): PlayerState {
  return buildPlayerStateFixture({
    activeAbilities: buildAbilities(),
    activeCreatureId: 'creature-1',
    activeVitals: { currentHp: 12, maxHp: 24 },
  });
}

function buildStateWithConsumable(): PlayerState {
  const state = buildState();
  state.backpack = [
    {
      category: 'consumable',
      description: 'Restaura a vida de uma criatura.',
      isStoreItem: true,
      itemId: POCAO_ID,
      name: 'Poção de Cura',
      price: 120,
      quantity: 3,
      slug: 'pocao-de-cura',
    },
  ];
  state.equippedConsumables = [
    {
      itemId: POCAO_ID,
      name: 'Poção de Cura',
      quantity: 3,
      slot: 4,
      triggerHpPercent: 30,
    },
  ];
  return state;
}

function expectChoice<T>(choice: T | null): T {
  if (choice === null) {
    throw new Error('the choice was refused');
  }
  return choice;
}

function expectLoadout(loadout: PendingLoadout | null): PendingLoadout {
  if (loadout === null) {
    throw new Error('the loadout is missing');
  }
  return loadout;
}

function readSlots(loadout: PendingLoadout): string[] {
  const slots: string[] = ['', '', '', ''];
  for (const equipped of loadout.abilities) {
    slots[equipped.slot] = equipped.abilityId;
  }
  return slots;
}

function findEquippedAbility(
  loadout: PendingLoadout,
  slot: SkillSlot,
): EquippedAbility | undefined {
  return loadout.abilities.find(function matches(entry: EquippedAbility): boolean {
    return entry.slot === slot;
  });
}

/**
 * The player changes two slots in a row, without waiting for the answer of the
 * server: the second choice is not refused.
 */
function acceptsTwoSlotsInARow(): void {
  const state = buildState();
  const first = expectChoice(planAbilityChoice(state, [], 0, BRASA_ID));
  const queue = appendCommand([], first.command);
  const second = planAbilityChoice(state, queue, 1, IGNEA_ID);
  expect(second).not.toBeNull();
  const pending = expectLoadout(
    readPendingLoadout(appendCommand(queue, expectChoice(second).command)),
  );
  expect(readSlots(pending)).toEqual([BRASA_ID, IGNEA_ID, '', '']);
}

test(
  'the player changes two slots in a row, without waiting for the server',
  acceptsTwoSlotsInARow,
);

/**
 * The loadout the second command carries has the change of the first one: the
 * server replaces the four slots with it, and the first choice would be lost
 * without it.
 */
function carriesTheChangeOfTheFirstCommand(): void {
  const state = buildState();
  const first = expectChoice(planAbilityChoice(state, [], 0, BRASA_ID));
  const queue = appendCommand([], first.command);
  const second = expectChoice(planAbilityChoice(state, queue, 1, IGNEA_ID));
  expect(second.abilityIds).toEqual([BRASA_ID, IGNEA_ID, '', '']);
  expect(first.abilityIds).toEqual([BRASA_ID, '', '', '']);
}

test(
  'the command of the second slot carries the change of the first one',
  carriesTheChangeOfTheFirstCommand,
);

/**
 * The same slot does not take two commands at the same time: the second one
 * would be built over a state the server never saw.
 */
function refusesTwoCommandsInTheSameSlot(): void {
  const state = buildState();
  const first = expectChoice(planAbilityChoice(state, [], 0, BRASA_ID));
  const queue = appendCommand([], first.command);
  const second = planAbilityChoice(state, queue, 0, IGNEA_ID);
  expect(second).toBeNull();
}

test('the same slot does not take two commands at the same time', refusesTwoCommandsInTheSameSlot);

/**
 * The same ability cannot be chosen twice while the first command is on its
 * way: the player would not know which one of the two wins.
 */
function refusesTheSameItemTwice(): void {
  const state = buildState();
  const first = expectChoice(planAbilityChoice(state, [], 0, BRASA_ID));
  const queue = appendCommand([], first.command);
  const second = planAbilityChoice(state, queue, 1, BRASA_ID);
  expect(second).toBeNull();
}

test('the same item cannot be chosen twice while the command flies', refusesTheSameItemTwice);

/**
 * A consumable of another slot is not refused by the command of a slot that
 * is on its way.
 */
function acceptsAConsumableOfAnotherSlot(): void {
  const state = buildStateWithConsumable();
  const first = expectChoice(planAbilityChoice(state, [], 0, BRASA_ID));
  const queue = appendCommand([], first.command);
  const second = planConsumableChoice(state, queue, 5, POCAO_ID, 30);
  expect(second).not.toBeNull();
}

test(
  'a consumable of another slot is not refused by the command of a slot that flies',
  acceptsAConsumableOfAnotherSlot,
);

/**
 * The capture device of another slot is not refused either.
 */
function acceptsTheDeviceWhileASlotIsBusy(): void {
  const state = buildStateWithConsumable();
  const first = expectChoice(planAbilityChoice(state, [], 0, BRASA_ID));
  const queue = appendCommand([], first.command);
  const second = planDeviceChoice(state, queue, 6, PRISMA_ID);
  expect(second).not.toBeNull();
}

test(
  'the capture device is not refused while a slot is waiting for the server',
  acceptsTheDeviceWhileASlotIsBusy,
);

/**
 * The life that triggers a consumable is a value and not an equipment: it
 * does not hold the slot, and the player can keep moving it.
 */
function acceptsTheTriggerWhileTheSlotIsBusy(): void {
  const state = buildStateWithConsumable();
  const first = planTriggerChoice(state, [], 4, 40);
  expect(first).not.toBeNull();
  const queue = appendCommand([], expectChoice(first).command);
  const second = planTriggerChoice(state, queue, 4, 45);
  expect(second).not.toBeNull();
  const pending = expectLoadout(
    readPendingLoadout(appendCommand(queue, expectChoice(second).command)),
  );
  expect(pending.consumables.at(0)?.triggerHpPercent).toBe(45);
}

test(
  'the life that triggers a consumable does not hold the slot of the consumable',
  acceptsTheTriggerWhileTheSlotIsBusy,
);

/**
 * The loadout the client shows is the one of the last command: it carries the
 * changes of all of them.
 */
function showsTheLoadoutOfTheLastCommand(): void {
  const state = buildState();
  const first = expectChoice(planAbilityChoice(state, [], 0, BRASA_ID));
  const queue = appendCommand([], first.command);
  const second = expectChoice(planAbilityChoice(state, queue, 1, IGNEA_ID));
  const pending = expectLoadout(readPendingLoadout(appendCommand(queue, second.command)));
  expect(findEquippedAbility(pending, 0)?.abilityId).toBe(BRASA_ID);
  expect(findEquippedAbility(pending, 1)?.abilityId).toBe(IGNEA_ID);
  expect(readLoadout(state).abilities.length).toBe(0);
}

test(
  'the loadout the client shows is the one of the last command',
  showsTheLoadoutOfTheLastCommand,
);
