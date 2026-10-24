/* eslint-disable max-lines -- the mapper scenarios share the row fixtures */
import { expect, test } from 'bun:test';

import { buildMap } from '~/__tests__/hunt/sim/fixtures';
import type {
  HuntAbilityRow,
  HuntCreatureRow,
  HuntDropRow,
  HuntEquippedAbilityRow,
  HuntGearSlotRow,
  HuntSpeciesAbilityRow,
  HuntSpeciesRow,
} from '~/db/huntContentRepository';
import {
  mapAbility,
  mapHuntAreaContent,
  mapSpeciesAbility,
  mapSpeciesRow,
} from '~/hunt/contentMappers';
import { HuntStartError } from '~/hunt/errors';
import { mapHuntTeam } from '~/hunt/teamMappers';

const AREA = {
  id: 'area-1',
  minimum_level: 3,
  name: 'Campina',
  recommended_level: 5,
  slug: 'campina-cinzenta',
};

function abilityRow(overrides?: Partial<HuntAbilityRow>): HuntAbilityRow {
  return {
    area_length: null,
    area_radius: null,
    area_shape: null,
    area_step_ms: 150,
    cooldown_ms: 4000,
    damage: 12,
    element: 'fire',
    id: 'ability-1',
    name: 'Brasa',
    range: 5,
    slug: 'brasa',
    target_type: 'target',
    travel_ms: 200,
    ...overrides,
  };
}

function speciesRow(overrides?: Partial<HuntSpeciesRow>): HuntSpeciesRow {
  return {
    base_experience: 100,
    base_magic_attack: 4,
    base_magic_defense: 2,
    base_physical_attack: 8,
    base_physical_defense: 7,
    base_vitality: 22,
    capture_chance: 0.05,
    element: 'fire',
    id: 'species-brasa',
    name: 'Brasa',
    slug: 'brasa',
    ...overrides,
  };
}

function speciesAbilityRow(overrides?: Partial<HuntSpeciesAbilityRow>): HuntSpeciesAbilityRow {
  return {
    abilities: abilityRow(),
    slot: 0,
    species_id: 'species-brasa',
    wild_chance: 20,
    wild_interval_ms: 2500,
    ...overrides,
  };
}

function dropRow(overrides?: Partial<HuntDropRow>): HuntDropRow {
  return {
    chance: 0.3,
    items: { id: 'item-a', name: 'Item A' },
    species_id: 'species-brasa',
    ...overrides,
  };
}

function creatureRow(overrides?: Partial<HuntCreatureRow>): HuntCreatureRow {
  return {
    current_hp: null,
    experience: 0,
    id: 'creature-1',
    level: 5,
    potential: { magicAttack: 50, vitality: 50 },
    species: speciesRow(),
    team_slot: 1,
    trainer_id: 'trainer-1',
    ...overrides,
  };
}

function gearRow(overrides?: Partial<HuntGearSlotRow>): HuntGearSlotRow {
  return {
    item_id: 'potion',
    items: {
      capture_multiplier: 1,
      cooldown_ms: 2000,
      heal_percent: 50,
      id: 'potion',
      name: 'Poção',
    },
    kind: 'consumable',
    slot: 4,
    trigger_hp_percent: 40,
    ...overrides,
  };
}

function equippedAbilityRow(overrides?: Partial<HuntEquippedAbilityRow>): HuntEquippedAbilityRow {
  return {
    abilities: abilityRow(),
    creature_id: 'creature-1',
    slot: 0,
    ...overrides,
  };
}

function mapsTheAbility(): void {
  const ability = mapAbility(abilityRow({ area_radius: 2, area_shape: 'circle' }));
  expect(ability).toEqual({
    areaLength: null,
    areaRadius: 2,
    areaShape: 'circle',
    areaStepMs: 150,
    cooldownMs: 4000,
    damage: 12,
    element: 'fire',
    name: 'Brasa',
    range: 5,
    slug: 'brasa',
    targetType: 'target',
    travelMs: 200,
  });
}

function mapsTheSpeciesAbility(): void {
  const mapped = mapSpeciesAbility(speciesAbilityRow({ wild_chance: 25, wild_interval_ms: 1000 }));
  expect(mapped?.wildChance).toBe(25);
  expect(mapped?.wildIntervalMs).toBe(1000);
  expect(mapped?.ability.slug).toBe('brasa');
}

function mapsTheSpecies(): void {
  const drop = { chance: 0.5, itemId: 'item-a', name: 'Item A' };
  const mapped = mapSpeciesRow(speciesRow(), [], [drop]);
  expect(mapped.base).toEqual({
    magicAttack: 4,
    magicDefense: 2,
    physicalAttack: 8,
    physicalDefense: 7,
    vitality: 22,
  });
  expect(mapped.baseExperience).toBe(100);
  expect(mapped.element).toBe('fire');
}

function ordersTheAreaContent(): void {
  const area = mapHuntAreaContent({
    abilityRows: [
      speciesAbilityRow({ slot: 1 }),
      speciesAbilityRow({ abilities: abilityRow({ slug: 'garra' }), slot: 0 }),
    ],
    area: AREA,
    dropRows: [
      dropRow({ items: { id: 'item-z', name: 'Z' } }),
      dropRow({ items: { id: 'item-a', name: 'A' } }),
    ],
    effectivenessRows: [{ attacker_element: 'fire', defender_element: 'plant', multiplier: 1.5 }],
    map: buildMap(),
    speciesRows: [speciesRow({ slug: 'broto' }), speciesRow()],
  });
  expect(Object.keys(area.content.species)).toEqual(['brasa', 'broto']);
  expect(area.content.species.brasa?.abilities.map(readAbilitySlug)).toEqual(['garra', 'brasa']);
  expect(area.content.species.brasa?.drops.map(readDropId)).toEqual(['item-a', 'item-z']);
  expect(area.content.effectiveness['fire:plant']).toBe(1.5);
  expect(area.minimumLevel).toBe(3);
}

function mapsTheTeam(): void {
  const team = mapHuntTeam({
    abilityRows: [
      equippedAbilityRow({ abilities: abilityRow({ slug: 'ignea' }), slot: 2 }),
      equippedAbilityRow({ slot: 0 }),
    ],
    gearRows: [
      gearRow(),
      gearRow({
        item_id: 'antidote',
        items: {
          capture_multiplier: 1,
          cooldown_ms: 0,
          heal_percent: null,
          id: 'antidote',
          name: 'Antídoto',
        },
        slot: 5,
      }),
    ],
    quantities: new Map([['potion', 3]]),
    staminaMinutes: 480,
    teamRows: [creatureRow({ id: 'creature-1', team_slot: 1 })],
  });
  expect(team.activeCreatureId).toBe('creature-1');
  expect(team.staminaMinutes).toBe(480);
  expect(team.team[0]?.abilities.map(readAbilitySlugOrNull)).toEqual([
    'brasa',
    null,
    'ignea',
    null,
  ]);
  expect(team.team[0]?.consumables).toEqual([
    {
      cooldownMs: 2000,
      healPercent: 50,
      itemId: 'potion',
      name: 'Poção',
      quantity: 3,
      slot: 4,
      triggerHpPercent: 40,
    },
  ]);
}

function mapsTheDevice(): void {
  const team = mapHuntTeam({
    abilityRows: [],
    gearRows: [
      gearRow({
        item_id: 'device',
        items: {
          capture_multiplier: 3,
          cooldown_ms: 0,
          heal_percent: null,
          id: 'device',
          name: 'Prisma',
        },
        kind: 'device',
        slot: 6,
      }),
    ],
    quantities: new Map([['device', 2]]),
    staminaMinutes: 480,
    teamRows: [creatureRow({ id: 'creature-1', team_slot: 1 })],
  });
  expect(team.device).toEqual({
    itemId: 'device',
    multiplier: 3,
    name: 'Prisma',
    quantity: 2,
    slot: 6,
  });
}

function fallsBackToTheFirstLivingCreature(): void {
  const team = mapHuntTeam({
    abilityRows: [],
    gearRows: [],
    quantities: new Map(),
    staminaMinutes: 30,
    teamRows: [
      creatureRow({ current_hp: 0, id: 'creature-dead', team_slot: 2 }),
      creatureRow({ current_hp: 10, id: 'creature-alive', team_slot: 3 }),
    ],
  });
  expect(team.activeCreatureId).toBe('creature-alive');
}

function refusesAnEmptyTeam(): void {
  expect(function startWithoutTeam(): void {
    mapHuntTeam({
      abilityRows: [],
      gearRows: [],
      quantities: new Map(),
      staminaMinutes: 480,
      teamRows: [],
    });
  }).toThrow(HuntStartError);
}

function readAbilitySlug(entry: { ability: { slug: string } }): string {
  return entry.ability.slug;
}

function readAbilitySlugOrNull(entry: { slug: string } | null): string | null {
  return entry === null ? null : entry.slug;
}

function readDropId(drop: { itemId: string }): string {
  return drop.itemId;
}

test('maps an ability', mapsTheAbility);
test('maps a species ability', mapsTheSpeciesAbility);
test('maps a species', mapsTheSpecies);
test('orders the area content', ordersTheAreaContent);
test('maps the team', mapsTheTeam);
test('maps the device', mapsTheDevice);
test('falls back to the first living creature', fallsBackToTheFirstLivingCreature);
test('refuses an empty team', refusesAnEmptyTeam);
