import { expect, test } from 'bun:test';

import type { PlayerState } from '@creatures/contracts/player';
import type { EquippedAbility } from '@creatures/contracts/skill';

import { buildPlayerStateFixture } from '~/entities/team';
import type { PanelCardEntry } from '~/features/skill-panel/model/skillPanel.types';
import { buildAbilitySlotPayloadFrom } from '~/features/skill-panel/model/skillPanelCommands';
import {
  buildAbilityEntries,
  buildConsumableEntries,
  buildDeviceEntries,
} from '~/features/skill-panel/model/skillPanelModel';
import {
  predictAbilityEquip,
  readLoadout,
} from '~/features/skill-panel/model/skillPanelPrediction';

const BRASA_ID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const IGNEA_ID = 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const GARRA_ID = 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f';
const POCAO_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

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
    equippedAbilities: [
      buildEquippedAbility(BRASA_ID, 0),
      buildEquippedAbility(IGNEA_ID, 1),
      buildEquippedAbility(GARRA_ID, 2),
    ],
  });
}

function findById(entries: PanelCardEntry[], id: string): PanelCardEntry | undefined {
  return entries.find(function matches(entry: PanelCardEntry): boolean {
    return entry.id === id;
  });
}

/**
 * An ability equipped in another slot does not show up in the panel: the same
 * ability cannot take two slots.
 */
function hidesTheAbilitiesOfTheOtherSlots(): void {
  const entries = buildAbilityEntries(buildState(), 0);
  expect(entries.length).toBe(1);
  expect(entries.at(0)?.id).toBe(BRASA_ID);
  expect(entries.at(0)?.selected).toBe(true);
}

test(
  'an ability equipped in another slot does not show up in the panel',
  hidesTheAbilitiesOfTheOtherSlots,
);

/**
 * A slot with nothing equipped shows the abilities that are free.
 */
function showsTheFreeAbilitiesOfAnEmptySlot(): void {
  const entries = buildAbilityEntries(buildState(), 3);
  expect(entries.length).toBe(0);
}

test('an empty slot shows the abilities that are not equipped', showsTheFreeAbilitiesOfAnEmptySlot);

/**
 * The loadout is the whole list of the four slots, and an empty slot is an
 * empty string in it.
 */
function keepsTheFourSlotsOfTheLoadout(): void {
  const payload = buildAbilitySlotPayloadFrom(readLoadout(buildState()));
  expect(payload).toEqual([BRASA_ID, IGNEA_ID, GARRA_ID, '']);
}

test(
  'the loadout keeps the four slots, with the empty one as an empty string',
  keepsTheFourSlotsOfTheLoadout,
);

/**
 * The ability that is clicked again leaves its slot.
 */
function clearsTheAbilityThatIsClickedAgain(): void {
  const state = buildState();
  const pending = predictAbilityEquip(readLoadout(state), state, 1, IGNEA_ID);
  expect(buildAbilitySlotPayloadFrom(pending)).toEqual([BRASA_ID, '', GARRA_ID, '']);
}

test('the ability that is clicked again leaves its slot', clearsTheAbilityThatIsClickedAgain);

/**
 * The same ability cannot take two slots: the slot it came from is emptied.
 */
function movesTheAbilityInsteadOfDuplicatingIt(): void {
  const state = buildState();
  const pending = predictAbilityEquip(readLoadout(state), state, 3, GARRA_ID);
  expect(buildAbilitySlotPayloadFrom(pending)).toEqual([BRASA_ID, IGNEA_ID, '', GARRA_ID]);
}

test('the same ability cannot take two slots', movesTheAbilityInsteadOfDuplicatingIt);

/**
 * The panel of consumables lists the whole catalog, the strongest on top, and
 * the consumable without quantity is disabled.
 */
function listsTheWholeCatalogOfConsumables(): void {
  const entries = buildConsumableEntries(buildState(), 4);
  expect(entries.length).toBeGreaterThan(1);
  expect(entries.at(0)?.name).toBe('Poção de Cura Forte');
  expect(entries.at(entries.length - 1)?.name).not.toBe('Poção de Cura Forte');
  expect(entries.at(0)?.disabled).toBe(true);
  expect(entries.at(0)?.note).toBe('Na mochila: 0');
}

test(
  'the panel of consumables lists the whole catalog, the strongest on top',
  listsTheWholeCatalogOfConsumables,
);

/**
 * The consumable that the trainer owns is the one that can be selected.
 */
function enablesTheConsumableOfTheBackpack(): void {
  const state = buildState();
  state.backpack = [
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
  const entries = buildConsumableEntries(state, 4);
  const found = findById(entries, POCAO_ID);
  expect(found?.disabled).toBe(false);
  expect(found?.note).toBe('Na mochila: 93');
}

test(
  'the consumable of the backpack is the one that can be selected',
  enablesTheConsumableOfTheBackpack,
);

/**
 * The panel of devices lists the devices, the best on top.
 */
function listsTheCatalogOfDevices(): void {
  const entries = buildDeviceEntries(buildState());
  expect(entries.length).toBeGreaterThan(1);
  expect(entries.at(0)?.disabled).toBe(true);
}

test('the panel of devices lists the devices, the best on top', listsTheCatalogOfDevices);
