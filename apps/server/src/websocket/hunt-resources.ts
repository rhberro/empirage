/* eslint-disable complexity, max-lines, max-lines-per-function, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
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
  areaRadius: number;
  category: HuntAbilityCategory;
  cooldownMs: number;
  id: number;
  isFire: boolean;
  name: string;
  power: number | null;
  rangeTiles: number;
  requiredLevel: number;
  slot: number;
  typeSlug: string;
  typeId: number;
};
export type HuntCreatureResource = {
  abilities: Array<HuntAbilityResource>;
  experience: string;
  id: string;
  ivAttack: number;
  ivDefense: number;
  ivHealth: number;
  ivSpecialAttack: number;
  ivSpecialDefense: number;
  ivSpeed: number;
  level: number;
  speciesId: number;
  teamPosition: number;
};
export type HuntSpeciesResource = {
  abilities: Array<HuntAbilityResource>;
  baseAttack: number;
  baseDefense: number;
  baseHealth: number;
  baseSpecialAttack: number;
  baseSpecialDefense: number;
  baseSpeed: number;
  id: number;
  name: string;
  typeIds: Array<number>;
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
  typeEffectiveness: Record<string, number>;
};

type CreatureRow = {
  experience: number | string;
  id: string;
  iv_attack: number;
  iv_defense: number;
  iv_hp: number;
  iv_special_attack: number;
  iv_special_defense: number;
  iv_speed: number;
  level: number;
  species_id: number;
  party_slot: number;
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
  base_hp: number;
  base_special_attack: number;
  base_special_defense: number;
  base_speed: number;
  id: number;
  name: string;
};
type EquippedAbilityRow = {
  move_id: number;
  creature_id: string;
  slot: number;
};
type SpeciesMoveRow = {
  move_id: number;
  required_level: number;
  species_id: number;
};
type AbilityAssignment = { abilityId: number; requiredLevel: number; slot: number };
type AbilityRow = {
  accuracy: number | null;
  category: HuntAbilityCategory;
  cooldown_ms: number;
  id: number;
  name: string;
  power: number | null;
  area_length: number;
  area_radius: number;
  area_shape: string;
  area_width: number;
  range_tiles: number;
  type_id: number;
};
type TypeRow = { id: number; slug: string };
type SpeciesTypeRow = { species_id: number; type_id: number };
type TypeEffectivenessRow = {
  attacker_type_id: number;
  defender_type_id: number;
  multiplier: number;
};
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
      .select(
        'id, species_id, party_slot, experience, level, iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed',
      )
      .eq('character_id', characterId)
      .not('party_slot', 'is', null)
      .order('party_slot'),
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
  const [speciesResult, equippedResult, speciesMoveResult, speciesTypesResult] = await Promise.all([
    client
      .from('species')
      .select(
        'id, name, base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed',
      )
      .in('id', speciesIds),
    client
      .from('creature_equipped_moves')
      .select('creature_id, move_id, slot')
      .in('creature_id', creatureIds)
      .order('slot'),
    client
      .from('species_move_learnsets')
      .select('species_id, move_id, required_level')
      .eq('learn_method', 'level')
      .in('species_id', speciesIds),
    client.from('species_types').select('species_id, type_id').in('species_id', speciesIds),
  ]);
  if (
    speciesResult.error ||
    equippedResult.error ||
    speciesMoveResult.error ||
    speciesTypesResult.error
  ) {
    throw (
      speciesResult.error ??
      equippedResult.error ??
      speciesMoveResult.error ??
      speciesTypesResult.error
    );
  }
  const equipped = equippedResult.data as Array<EquippedAbilityRow>;
  const speciesMoves = speciesMoveResult.data as Array<SpeciesMoveRow>;
  const abilityIds = uniqueNumbers(
    [...equipped, ...speciesMoves].map(function assignmentAbility(
      row: EquippedAbilityRow | SpeciesMoveRow,
    ): number {
      return row.move_id;
    }),
  );
  let abilityRows: Array<AbilityRow> = [];
  if (abilityIds.length > 0) {
    const abilityResult = await client
      .from('moves')
      .select(
        'id, name, category, type_id, power, accuracy, cooldown_ms, range_tiles, area_radius, area_length, area_width, area_shape',
      )
      .in('id', abilityIds);
    if (abilityResult.error) {
      throw abilityResult.error;
    }
    abilityRows = abilityResult.data as Array<AbilityRow>;
  }
  const speciesTypes = speciesTypesResult.data as Array<SpeciesTypeRow>;
  const typeIds = uniqueNumbers([
    ...abilityRows.map(function abilityType(row: AbilityRow): number {
      return row.type_id;
    }),
    ...speciesTypes.map(function speciesType(row: SpeciesTypeRow): number {
      return row.type_id;
    }),
  ]);
  let typeRows: Array<TypeRow> = [];
  let typeEffectivenessRows: Array<TypeEffectivenessRow> = [];
  if (typeIds.length > 0) {
    const [typeResult, typeEffectivenessResult] = await Promise.all([
      client.from('types').select('id, slug').in('id', typeIds),
      client
        .from('type_effectiveness')
        .select('attacker_type_id, defender_type_id, multiplier')
        .in('attacker_type_id', typeIds)
        .in('defender_type_id', typeIds),
    ]);
    if (typeResult.error || typeEffectivenessResult.error) {
      throw typeResult.error ?? typeEffectivenessResult.error;
    }
    typeRows = typeResult.data as Array<TypeRow>;
    typeEffectivenessRows = typeEffectivenessResult.data as Array<TypeEffectivenessRow>;
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
        areaRadius: Math.max(ability.area_radius, ability.area_length, ability.area_width),
        category: ability.category,
        cooldownMs: ability.cooldown_ms,
        id: ability.id,
        isFire: typeSlugs.get(ability.type_id) === 'fire',
        name: ability.name,
        power: ability.power,
        rangeTiles: ability.range_tiles,
        requiredLevel: assignment.requiredLevel,
        slot: assignment.slot,
        typeId: ability.type_id,
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
      levelByAbilityId.set(move.move_id, move.required_level);
    }
    const assignments = equippedAbilities.flatMap(function equippedMove(
      assignment: EquippedAbilityRow,
    ): Array<AbilityAssignment> {
      const requiredLevel = levelByAbilityId.get(assignment.move_id);
      return requiredLevel === undefined
        ? []
        : [{ abilityId: assignment.move_id, requiredLevel, slot: assignment.slot }];
    });
    creatures.push({
      abilities: resolveAssignments(assignments),
      experience: safeExperience(row.experience),
      id: row.id,
      ivAttack: row.iv_attack,
      ivDefense: row.iv_defense,
      ivHealth: row.iv_hp,
      ivSpecialAttack: row.iv_special_attack,
      ivSpecialDefense: row.iv_special_defense,
      ivSpeed: row.iv_speed,
      level: row.level,
      speciesId: row.species_id,
      teamPosition: row.party_slot,
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
          abilityId: move.move_id,
          requiredLevel: move.required_level,
          slot: move.move_id,
        };
      });
    assignments.sort(function sortByAbility(first, second): number {
      return first.abilityId - second.abilityId;
    });
    species[String(row.id)] = {
      abilities: resolveAssignments(assignments),
      baseAttack: row.base_attack,
      baseDefense: row.base_defense,
      baseHealth: row.base_hp,
      baseSpecialAttack: row.base_special_attack,
      baseSpecialDefense: row.base_special_defense,
      baseSpeed: row.base_speed,
      id: row.id,
      name: row.name,
      typeIds: speciesTypes
        .filter(function sameSpecies(type: SpeciesTypeRow): boolean {
          return type.species_id === row.id;
        })
        .map(function typeId(type: SpeciesTypeRow): number {
          return type.type_id;
        }),
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
  const typeEffectiveness: Record<string, number> = {};
  for (const row of typeEffectivenessRows) {
    typeEffectiveness[row.attacker_type_id + ':' + row.defender_type_id] = row.multiplier;
  }
  return {
    creatures,
    encounters,
    ...healingResources,
    locationId,
    species,
    typeEffectiveness,
  };
}
