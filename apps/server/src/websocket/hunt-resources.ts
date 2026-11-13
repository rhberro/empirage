/* eslint-disable max-lines, max-lines-per-function, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadCharacterHealingResources,
  type HealingConfigurationResource,
  type HealingItemResource,
} from './healing-items.ts';
import { safeExperience, uniqueNumbers } from './hunt-resource-values.ts';

export type { HealingConfigurationResource, HealingItemResource } from './healing-items.ts';

export type HuntAbilityCategory = 'physical' | 'special' | 'status';
export type HuntAbilityResource = {
  accuracy: number | null;
  category: HuntAbilityCategory;
  cooldownMs: number;
  id: number;
  isFire: boolean;
  name: string;
  power: number | null;
  requiredLevel: number;
  slot: number;
  typeSlug: string;
};
export type HuntCreatureResource = {
  abilities: Array<HuntAbilityResource>;
  experience: string;
  id: string;
  level: number;
  speciesId: number;
  teamPosition: number;
};
export type HuntSpeciesResource = {
  abilities: Array<HuntAbilityResource>;
  baseAttack: number;
  baseDefense: number;
  baseHealth: number;
  baseSpeed: number;
  id: number;
  name: string;
};
export type HuntEncounterResource = {
  maximumLevel: number;
  minimumLevel: number;
  speciesId: number;
  weight: number;
};
export type HuntResources = {
  creatures: Array<HuntCreatureResource>;
  encounters: Array<HuntEncounterResource>;
  gold: number;
  healingConfiguration: HealingConfigurationResource | undefined;
  healingItems: Array<HealingItemResource>;
  locationId: number;
  species: Record<string, HuntSpeciesResource>;
};

type CreatureRow = {
  experience: number | string;
  id: string;
  level: number;
  species_id: number;
  team_position: number;
};
type EncounterRow = {
  encounter_weight: number;
  maximum_level: number;
  minimum_level: number;
  species_id: number;
};
type SpeciesRow = {
  base_attack: number;
  base_defense: number;
  base_health: number;
  base_speed: number;
  id: number;
  name: string;
};
type EquippedAbilityRow = {
  ability_id: number;
  creature_id: string;
  slot: number;
};
type SpeciesMoveRow = {
  ability_id: number;
  required_level: number;
  species_id: number;
};
type AbilityAssignment = { abilityId: number; requiredLevel: number; slot: number };
type AbilityRow = {
  accuracy: number | null;
  category: HuntAbilityCategory;
  cooldown_seconds: number;
  id: number;
  name: string;
  power: number | null;
  type_id: number;
};
type TypeRow = { id: number; slug: string };
type ResourceQueries = [
  PromiseLike<{ data: unknown; error: unknown }>,
  PromiseLike<{ data: unknown; error: unknown }>,
];

export async function loadHuntResources(
  client: SupabaseClient,
  characterId: string,
  locationId: number,
): Promise<HuntResources> {
  const queries: ResourceQueries = [
    client
      .from('creatures')
      .select('id, species_id, team_position, experience, level')
      .eq('character_id', characterId)
      .eq('status', 'active')
      .order('team_position'),
    client
      .from('hunting_location_species')
      .select('species_id, minimum_level, maximum_level, encounter_weight')
      .eq('hunting_location_id', locationId),
  ];
  const [creatureResult, encounterResult] = await Promise.all(queries);
  if (creatureResult.error) {
    throw creatureResult.error;
  }
  if (encounterResult.error) {
    throw encounterResult.error;
  }
  const creatureRows = creatureResult.data as Array<CreatureRow>;
  const encounterRows = encounterResult.data as Array<EncounterRow>;
  if (creatureRows.length === 0) {
    throw new Error('no_active_creatures');
  }
  if (encounterRows.length === 0) {
    throw new Error('hunting_location_has_no_species');
  }
  const healingResources = await loadCharacterHealingResources(client, characterId);
  const speciesIds = uniqueNumbers([
    ...creatureRows.map(function creatureSpecies(row: CreatureRow): number {
      return row.species_id;
    }),
    ...encounterRows.map(function encounterSpecies(row: EncounterRow): number {
      return row.species_id;
    }),
  ]);
  const creatureIds = creatureRows.map(function creatureId(row: CreatureRow): string {
    return row.id;
  });
  const [speciesResult, equippedResult, speciesMoveResult] = await Promise.all([
    client
      .from('creature_species')
      .select('id, name, base_health, base_attack, base_defense, base_speed')
      .in('id', speciesIds),
    client
      .from('creature_equipped_abilities')
      .select('creature_id, ability_id, slot')
      .in('creature_id', creatureIds)
      .order('slot'),
    client
      .from('creature_species_moves')
      .select('species_id, ability_id, required_level')
      .in('species_id', speciesIds),
  ]);
  if (speciesResult.error || equippedResult.error || speciesMoveResult.error) {
    throw speciesResult.error ?? equippedResult.error ?? speciesMoveResult.error;
  }
  const equipped = equippedResult.data as Array<EquippedAbilityRow>;
  const speciesMoves = speciesMoveResult.data as Array<SpeciesMoveRow>;
  const abilityIds = uniqueNumbers(
    [...equipped, ...speciesMoves].map(function assignmentAbility(
      row: EquippedAbilityRow | SpeciesMoveRow,
    ): number {
      return row.ability_id;
    }),
  );
  let abilityRows: Array<AbilityRow> = [];
  if (abilityIds.length > 0) {
    const abilityResult = await client
      .from('abilities')
      .select('id, name, category, type_id, power, accuracy, cooldown_seconds')
      .in('id', abilityIds)
      .eq('kind', 'move');
    if (abilityResult.error) {
      throw abilityResult.error;
    }
    abilityRows = abilityResult.data as Array<AbilityRow>;
  }
  const typeIds = uniqueNumbers(
    abilityRows.map(function abilityType(row: AbilityRow): number {
      return row.type_id;
    }),
  );
  let typeRows: Array<TypeRow> = [];
  if (typeIds.length > 0) {
    const typeResult = await client.from('creature_types').select('id, slug').in('id', typeIds);
    if (typeResult.error) {
      throw typeResult.error;
    }
    typeRows = typeResult.data as Array<TypeRow>;
  }
  const typeSlugs = new Map<number, string>();
  for (const row of typeRows) {
    typeSlugs.set(row.id, row.slug);
  }
  const abilities = new Map<number, AbilityRow>();
  for (const row of abilityRows) {
    abilities.set(row.id, row);
  }
  function resolveAssignments(rows: Array<AbilityAssignment>): Array<HuntAbilityResource> {
    const resolved: Array<HuntAbilityResource> = [];
    for (const assignment of rows) {
      const ability = abilities.get(assignment.abilityId);
      if (!ability) {
        continue;
      }
      resolved.push({
        accuracy: ability.accuracy,
        category: ability.category,
        cooldownMs: Math.max(1_000, ability.cooldown_seconds * 1_000),
        id: ability.id,
        isFire: typeSlugs.get(ability.type_id) === 'fire',
        name: ability.name,
        power: ability.power,
        requiredLevel: assignment.requiredLevel,
        slot: assignment.slot,
        typeSlug: typeSlugs.get(ability.type_id) ?? 'normal',
      });
    }
    return resolved;
  }
  const creatures: Array<HuntCreatureResource> = [];
  for (const row of creatureRows) {
    const equippedAbilities = equipped.filter(function forCreature(
      assignment: EquippedAbilityRow,
    ): boolean {
      return assignment.creature_id === row.id;
    });
    const availableMoves = speciesMoves.filter(function forSpecies(move: SpeciesMoveRow): boolean {
      return move.species_id === row.species_id;
    });
    const levelByAbilityId = new Map<number, number>();
    for (const move of availableMoves) {
      levelByAbilityId.set(move.ability_id, move.required_level);
    }
    const assignments = equippedAbilities.flatMap(function equippedMove(
      assignment: EquippedAbilityRow,
    ): Array<AbilityAssignment> {
      const requiredLevel = levelByAbilityId.get(assignment.ability_id);
      return requiredLevel === undefined
        ? []
        : [{ abilityId: assignment.ability_id, requiredLevel, slot: assignment.slot }];
    });
    creatures.push({
      abilities: resolveAssignments(assignments),
      experience: safeExperience(row.experience),
      id: row.id,
      level: row.level,
      speciesId: row.species_id,
      teamPosition: row.team_position,
    });
  }
  const species: Record<string, HuntSpeciesResource> = {};
  for (const row of speciesResult.data as Array<SpeciesRow>) {
    const assignments = speciesMoves
      .filter(function forSpecies(move: SpeciesMoveRow): boolean {
        return move.species_id === row.id;
      })
      .map(function speciesMove(move: SpeciesMoveRow): AbilityAssignment {
        return {
          abilityId: move.ability_id,
          requiredLevel: move.required_level,
          slot: move.ability_id,
        };
      });
    assignments.sort(function sortByAbility(first, second): number {
      return first.abilityId - second.abilityId;
    });
    species[String(row.id)] = {
      abilities: resolveAssignments(assignments),
      baseAttack: row.base_attack,
      baseDefense: row.base_defense,
      baseHealth: row.base_health,
      baseSpeed: row.base_speed,
      id: row.id,
      name: row.name,
    };
  }
  const encounters = encounterRows.map(function encounter(
    row: EncounterRow,
  ): HuntEncounterResource {
    return {
      maximumLevel: row.maximum_level,
      minimumLevel: row.minimum_level,
      speciesId: row.species_id,
      weight: row.encounter_weight,
    };
  });
  return {
    creatures,
    encounters,
    ...healingResources,
    locationId,
    species,
  };
}
