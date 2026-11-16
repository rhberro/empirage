/* eslint-disable complexity, max-lines, max-lines-per-function, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadCharacterCaptureResources,
  type CaptureConfigurationResource,
  type CaptureItemResource,
} from './capture-items.ts';
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
  effects: Array<HuntStatEffectResource>;
  name: string;
  power: number | null;
  rangeTiles: number;
  requiredLevel: number;
  slot: number;
  target: 'self' | 'tile' | 'unit';
  typeSlug: string;
  typeId: number;
};
export type HuntBattleStat =
  | 'attack'
  | 'defense'
  | 'specialAttack'
  | 'specialDefense'
  | 'speed'
  | 'accuracy'
  | 'evasion';
export type HuntStatEffectResource = {
  chance: number;
  stage: number;
  stat: HuntBattleStat;
  target: 'target' | 'user';
};
export type HuntCreatureResource = {
  abilities: Array<HuntAbilityResource>;
  experience: string;
  evAttack: number;
  evDefense: number;
  evHealth: number;
  evSpecialAttack: number;
  evSpecialDefense: number;
  evSpeed: number;
  id: string;
  ivAttack: number;
  ivDefense: number;
  ivHealth: number;
  ivSpecialAttack: number;
  ivSpecialDefense: number;
  ivSpeed: number;
  level: number;
  nature: HuntNatureResource;
  speciesId: number;
  teamPosition: number;
};
export type HuntNatureResource = {
  decreasedStat: Exclude<HuntBattleStat, 'accuracy' | 'evasion'> | null;
  increasedStat: Exclude<HuntBattleStat, 'accuracy' | 'evasion'> | null;
  slug: string;
};
export type HuntCharacterResource = {
  avatarUrl: string | null;
  level: number;
  name: string;
};
export type HuntEvolutionResource = {
  fromSpeciesId: number;
  requiredLevel: number;
  toSpeciesId: number;
};
export type HuntSpeciesResource = {
  abilities: Array<HuntAbilityResource>;
  baseAttack: number;
  baseDefense: number;
  baseHealth: number;
  baseSpecialAttack: number;
  baseSpecialDefense: number;
  baseSpeed: number;
  evYieldAttack: number;
  evYieldDefense: number;
  evYieldHealth: number;
  evYieldSpecialAttack: number;
  evYieldSpecialDefense: number;
  evYieldSpeed: number;
  id: number;
  name: string;
  typeIds: Array<number>;
  typeSlugs: Array<string>;
};
export type HuntEncounterResource = {
  maximumLevel: number;
  minimumLevel: number;
  speciesId: number;
  weight: number;
};
export type HuntResources = {
  activeCreatureId: string | null;
  captureConfiguration: CaptureConfigurationResource | undefined;
  captureItems: Array<CaptureItemResource>;
  character: HuntCharacterResource;
  creatures: Array<HuntCreatureResource>;
  encounters: Array<HuntEncounterResource>;
  evolutions: Array<HuntEvolutionResource>;
  gold: number;
  healingConfiguration: HealingConfigurationResource | undefined;
  healingItems: Array<HealingItemResource>;
  locationId: number;
  species: Record<string, HuntSpeciesResource>;
  typeEffectiveness: Record<string, number>;
};

type CreatureRow = {
  ev_attack: number;
  ev_defense: number;
  ev_hp: number;
  ev_special_attack: number;
  ev_special_defense: number;
  ev_speed: number;
  experience: number | string;
  id: string;
  iv_attack: number;
  iv_defense: number;
  iv_hp: number;
  iv_special_attack: number;
  iv_special_defense: number;
  iv_speed: number;
  level: number;
  nature_slug: string;
  species_id: number;
  party_slot: number;
};
type NatureRow = {
  decreased_stat: string | null;
  increased_stat: string | null;
  slug: string;
};
type CharacterRow = {
  active_creature_id: string | null;
  avatar_url: string | null;
  level: number;
  name: string;
};
type EvolutionRow = {
  from_species_id: number;
  required_level: number;
  to_species_id: number;
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
  ev_yield_attack: number;
  ev_yield_defense: number;
  ev_yield_hp: number;
  ev_yield_special_attack: number;
  ev_yield_special_defense: number;
  ev_yield_speed: number;
  id: number;
  name: string;
};
type MoveStatEffectRow = {
  chance: number;
  move_id: number;
  stage: number;
  stat: string;
  target: 'target' | 'user';
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
  target: 'self' | 'tile' | 'unit';
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

function databaseStat(value: string | null): HuntBattleStat | null {
  switch (value) {
    case 'attack':
      return 'attack';
    case 'defense':
      return 'defense';
    case 'special_attack':
      return 'specialAttack';
    case 'special_defense':
      return 'specialDefense';
    case 'speed':
      return 'speed';
    case 'accuracy':
      return 'accuracy';
    case 'evasion':
      return 'evasion';
    default:
      return null;
  }
}

export async function loadHuntResources(
  client: SupabaseClient,
  characterId: string,
  locationId: number,
): Promise<HuntResources> {
  const queries: ResourceQueries = [
    client
      .from('creatures')
      .select(
        'id, species_id, party_slot, experience, level, nature_slug, iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed, ev_hp, ev_attack, ev_defense, ev_special_attack, ev_special_defense, ev_speed',
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
  const [healingResources, captureResources] = await Promise.all([
    loadCharacterHealingResources(client, characterId),
    loadCharacterCaptureResources(client, characterId),
  ]);
  const [characterResult, evolutionResult, natureResult] = await Promise.all([
    client
      .from('characters')
      .select('name, level, avatar_url, active_creature_id')
      .eq('id', characterId)
      .single(),
    client
      .from('evolutions')
      .select('from_species_id, to_species_id, required_level')
      .eq('trigger', 'level'),
    client.from('natures').select('slug, increased_stat, decreased_stat'),
  ]);
  if (characterResult.error || natureResult.error) {
    throw characterResult.error ?? natureResult.error;
  }
  if (evolutionResult.error) {
    throw evolutionResult.error;
  }
  const character = characterResult.data as CharacterRow;
  const natures = new Map<string, HuntNatureResource>();
  for (const row of natureResult.data as Array<NatureRow>) {
    const increasedStat = databaseStat(row.increased_stat);
    const decreasedStat = databaseStat(row.decreased_stat);
    if (
      increasedStat === 'accuracy' ||
      increasedStat === 'evasion' ||
      decreasedStat === 'accuracy' ||
      decreasedStat === 'evasion'
    ) {
      continue;
    }
    natures.set(row.slug, { decreasedStat, increasedStat, slug: row.slug });
  }
  const evolutionRows = evolutionResult.data as Array<EvolutionRow>;
  const evolutions = evolutionRows.map(function evolution(
    row: EvolutionRow,
  ): HuntEvolutionResource {
    return {
      fromSpeciesId: row.from_species_id,
      requiredLevel: row.required_level,
      toSpeciesId: row.to_species_id,
    };
  });
  const speciesIds = uniqueNumbers([
    ...creatureRows.map(function creatureSpecies(row: CreatureRow): number {
      return row.species_id;
    }),
    ...encounterRows.map(function encounterSpecies(row: EncounterRow): number {
      return row.species_id;
    }),
    ...evolutionRows.map(function evolutionSpecies(row: EvolutionRow): number {
      return row.to_species_id;
    }),
  ]);
  const creatureIds = creatureRows.map(function creatureId(row: CreatureRow): string {
    return row.id;
  });
  const [speciesResult, equippedResult, speciesMoveResult, speciesTypesResult] = await Promise.all([
    client
      .from('species')
      .select(
        'id, name, base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed, ev_yield_hp, ev_yield_attack, ev_yield_defense, ev_yield_special_attack, ev_yield_special_defense, ev_yield_speed',
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
  const effectsByMove = new Map<number, Array<HuntStatEffectResource>>();
  if (abilityIds.length > 0) {
    const [abilityResult, effectResult] = await Promise.all([
      client
        .from('moves')
        .select(
          'id, name, category, type_id, power, accuracy, cooldown_ms, range_tiles, area_radius, area_length, area_width, area_shape, target',
        )
        .in('id', abilityIds),
      client
        .from('move_stat_effects')
        .select('move_id, stat, stage, chance, target')
        .in('move_id', abilityIds),
    ]);
    if (abilityResult.error || effectResult.error) {
      throw abilityResult.error ?? effectResult.error;
    }
    abilityRows = abilityResult.data as Array<AbilityRow>;
    for (const row of effectResult.data as Array<MoveStatEffectRow>) {
      const stat = databaseStat(row.stat);
      if (!stat) {
        continue;
      }
      const effects = effectsByMove.get(row.move_id) ?? [];
      effects.push({ chance: row.chance, stage: row.stage, stat, target: row.target });
      effectsByMove.set(row.move_id, effects);
    }
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
        effects: effectsByMove.get(ability.id) ?? [],
        id: ability.id,
        isFire: typeSlugs.get(ability.type_id) === 'fire',
        name: ability.name,
        power: ability.power,
        rangeTiles: ability.range_tiles,
        requiredLevel: assignment.requiredLevel,
        slot: assignment.slot,
        target: ability.target,
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
    const nature = natures.get(row.nature_slug);
    if (!nature) {
      throw new TypeError('creature_nature_missing');
    }
    creatures.push({
      abilities: resolveAssignments(assignments),
      evAttack: row.ev_attack,
      evDefense: row.ev_defense,
      evHealth: row.ev_hp,
      evSpecialAttack: row.ev_special_attack,
      evSpecialDefense: row.ev_special_defense,
      evSpeed: row.ev_speed,
      experience: safeExperience(row.experience),
      id: row.id,
      ivAttack: row.iv_attack,
      ivDefense: row.iv_defense,
      ivHealth: row.iv_hp,
      ivSpecialAttack: row.iv_special_attack,
      ivSpecialDefense: row.iv_special_defense,
      ivSpeed: row.iv_speed,
      level: row.level,
      nature,
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
      evYieldAttack: row.ev_yield_attack,
      evYieldDefense: row.ev_yield_defense,
      evYieldHealth: row.ev_yield_hp,
      evYieldSpecialAttack: row.ev_yield_special_attack,
      evYieldSpecialDefense: row.ev_yield_special_defense,
      evYieldSpeed: row.ev_yield_speed,
      id: row.id,
      name: row.name,
      typeIds: speciesTypes
        .filter(function sameSpecies(type: SpeciesTypeRow): boolean {
          return type.species_id === row.id;
        })
        .map(function typeId(type: SpeciesTypeRow): number {
          return type.type_id;
        }),
      typeSlugs: speciesTypes
        .filter(function sameSpecies(type: SpeciesTypeRow): boolean {
          return type.species_id === row.id;
        })
        .map(function typeSlug(type: SpeciesTypeRow): string {
          return typeSlugs.get(type.type_id) ?? 'normal';
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
    activeCreatureId: character.active_creature_id,
    ...captureResources,
    character: {
      avatarUrl: character.avatar_url,
      level: character.level,
      name: character.name,
    },
    creatures,
    encounters,
    evolutions,
    ...healingResources,
    locationId,
    species,
    typeEffectiveness,
  };
}
