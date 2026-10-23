import { expect, test } from 'bun:test';

import {
  mapAbilitiesBySpecies,
  mapCreatureRow,
  mapPotential,
  mapSpeciesRow,
  mapStarterSpeciesRows,
  mapTeamSlots,
  mapTrainerRow,
} from '~/db/mappers';
import type { TrainerRow, CreatureRow, SpeciesRow, SpeciesAbilityRow } from '~/db/types';

const TRAINER_ROW: TrainerRow = {
  created_at: '2026-01-01T00:00:00.000Z',
  diamonds: 7,
  gender: 'female',
  gold: 120,
  id: '11111111-1111-4111-8111-111111111111',
  level: 3,
  name: 'Ana',
  owner_id: '22222222-2222-4222-8222-222222222222',
  stamina_minutes: 600,
  starter_species_id: '33333333-3333-4333-8333-333333333333',
};

const CREATURE_ROW: CreatureRow = {
  captured_at: '2026-01-02T00:00:00.000Z',
  created_at: '2026-01-02T00:00:00.000Z',
  experience: 40,
  id: '44444444-4444-4444-8444-444444444444',
  is_in_team: true,
  level: 2,
  nickname: 'Brasinha',
  potential: {
    magicAttack: 10,
    magicDefense: 20,
    physicalAttack: 30,
    physicalDefense: 40,
    vitality: 50,
  },
  species: {
    base_magic_attack: 4,
    base_magic_defense: 2,
    base_physical_attack: 8,
    base_physical_defense: 7,
    base_vitality: 22,
    element: 'fire',
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Brasa',
    slug: 'brasa',
  },
  species_id: '33333333-3333-4333-8333-333333333333',
  team_slot: 1,
  trainer_id: '11111111-1111-4111-8111-111111111111',
};

const SPECIES_ROW: SpeciesRow = {
  base_experience: 100,
  base_magic_attack: 4,
  base_magic_defense: 2,
  base_physical_attack: 8,
  base_physical_defense: 7,
  base_vitality: 22,
  capture_chance: '0.05000',
  description: 'Ágil e resistente.',
  element: 'fire',
  id: '33333333-3333-4333-8333-333333333333',
  is_starter: true,
  name: 'Brasa',
  slug: 'brasa',
};

const ABILITY_ROWS: SpeciesAbilityRow[] = [
  {
    abilities: {
      cooldown_ms: 7000,
      damage: 24,
      description: 'Explosão de fogo.',
      element: 'fire',
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Ígnea',
      slug: 'ignea',
    },
    slot: 1,
    species_id: '33333333-3333-4333-8333-333333333333',
  },
  {
    abilities: {
      cooldown_ms: 4000,
      damage: 12,
      description: 'Ataque de fogo rápido.',
      element: 'fire',
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Brasa',
      slug: 'brasa',
    },
    slot: 0,
    species_id: '33333333-3333-4333-8333-333333333333',
  },
];

function mapTrainerRowFields(): void {
  const trainer = mapTrainerRow(TRAINER_ROW);
  expect(trainer.id).toBe(TRAINER_ROW.id);
  expect(trainer.name).toBe('Ana');
  expect(trainer.gender).toBe('female');
  expect(trainer.level).toBe(3);
  expect(trainer.gold).toBe(120);
  expect(trainer.diamonds).toBe(7);
  expect(trainer.staminaMinutes).toBe(600);
  expect(trainer.starterSpeciesId).toBe(TRAINER_ROW.starter_species_id);
  expect(trainer.createdAt).toBe(TRAINER_ROW.created_at);
}

function mapCreatureRowFields(): void {
  const creature = mapCreatureRow(CREATURE_ROW);
  expect(creature.trainerId).toBe(CREATURE_ROW.trainer_id);
  expect(creature.speciesId).toBe(CREATURE_ROW.species_id);
  expect(creature.isInTeam).toBe(true);
  expect(creature.teamSlot).toBe(1);
  expect(creature.capturedAt).toBe(CREATURE_ROW.captured_at);
  expect(creature.nickname).toBe('Brasinha');
  expect(creature.potential.vitality).toBe(50);
  expect(creature.potential.physicalAttack).toBe(30);
}

function mapCreatureRowReadsTheSpecies(): void {
  const creature = mapCreatureRow(CREATURE_ROW);
  expect(creature.species.name).toBe('Brasa');
  expect(creature.species.slug).toBe('brasa');
  expect(creature.species.element).toBe('fire');
  expect(creature.species.id).toBe(CREATURE_ROW.species_id);
}

function mapPotentialFallbacks(): void {
  const potential = mapPotential({ magicAttack: 12 });
  expect(potential.magicAttack).toBe(12);
  expect(potential.vitality).toBe(50);
  expect(mapPotential(null).vitality).toBe(50);
}

function mapSpeciesRowFields(): void {
  const abilities = mapAbilitiesBySpecies(ABILITY_ROWS);
  const species = mapSpeciesRow(SPECIES_ROW, abilities.get(SPECIES_ROW.id) ?? []);
  expect(species.baseVitality).toBe(22);
  expect(species.basePhysicalAttack).toBe(8);
  expect(species.baseMagicAttack).toBe(4);
  expect(species.basePhysicalDefense).toBe(7);
  expect(species.baseMagicDefense).toBe(2);
  expect(species.captureChance).toBe(0.05);
  expect(species.isStarter).toBe(true);
}

function mapStarterSpeciesKeepsAbilityOrder(): void {
  const abilities = mapAbilitiesBySpecies(ABILITY_ROWS);
  const starters = mapStarterSpeciesRows([SPECIES_ROW], abilities);
  expect(starters).toHaveLength(1);
  const starter = starters[0];
  expect(starter?.isStarter).toBe(true);
  expect(starter?.abilities.map(readAbilityName)).toEqual(['Brasa', 'Ígnea']);
}

function mapTeamSlotsSkipsMissingSlot(): void {
  const withoutSlot: CreatureRow = { ...CREATURE_ROW, team_slot: null };
  const slots = mapTeamSlots([CREATURE_ROW, withoutSlot]);
  expect(slots).toHaveLength(1);
  expect(slots[0]?.slot).toBe(1);
  expect(slots[0]?.creature.id).toBe(CREATURE_ROW.id);
}

function readAbilityName(ability: { name: string }): string {
  return ability.name;
}

test('mapTrainerRow maps snake_case to camelCase', mapTrainerRowFields);
test('mapCreatureRow maps snake_case to camelCase', mapCreatureRowFields);
test('mapCreatureRow reads the joined species', mapCreatureRowReadsTheSpecies);
test('mapPotential falls back to the neutral potential', mapPotentialFallbacks);
test('mapSpeciesRow maps the base attributes', mapSpeciesRowFields);
test(
  'mapStarterSpeciesRows keeps the abilities ordered by slot',
  mapStarterSpeciesKeepsAbilityOrder,
);
test('mapTeamSlots ignores creatures without a team slot', mapTeamSlotsSkipsMissingSlot);
