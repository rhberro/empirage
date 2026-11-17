/* eslint-disable complexity, max-lines, max-lines-per-function, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadCatalog } from '../game/catalog-cache.ts';
import {
  CAPTURE_RARITIES,
  loadCaptureItems,
  type CaptureConfigurationResource,
  type CaptureItemResource,
  type CaptureRarity,
} from './capture-items.ts';
import {
  loadHealingItems,
  type HealingConfigurationResource,
  type HealingItemResource,
} from './healing-items.ts';
import { safeExperience } from './hunt-resource-values.ts';

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
type HuntBootstrap = {
  active_creature_id: string | null;
  avatar_url: string | null;
  capture_configuration: BootstrapCaptureConfiguration | null;
  creatures: Array<CreatureRow>;
  equipped_moves: Array<EquippedAbilityRow>;
  gold: number;
  healing_configuration: BootstrapHealingConfiguration | null;
  level: number;
  name: string;
};
type BootstrapHealingConfiguration = { item_id: number; threshold_percentage: number };
type BootstrapCaptureConfiguration = { item_id: number; rarities: Array<string> };
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
type HuntingLocationSpeciesRow = EncounterRow & { hunting_location_id: number };
type StaticHuntCatalog = {
  abilityTemplates: Map<number, HuntAbilityResource>;
  encountersByLocation: Map<number, Array<HuntEncounterResource>>;
  evolutions: Array<HuntEvolutionResource>;
  naturesBySlug: Map<string, HuntNatureResource>;
  species: Record<string, HuntSpeciesResource>;
  typeEffectiveness: Record<string, number>;
};

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

function isCaptureRarity(value: string): value is CaptureRarity {
  return CAPTURE_RARITIES.includes(value as CaptureRarity);
}

function healingConfiguration(
  configuration: BootstrapHealingConfiguration | null,
  items: Array<HealingItemResource>,
): HealingConfigurationResource | undefined {
  if (!configuration) {
    return undefined;
  }
  const item = items.find(function configuredItem(candidate): boolean {
    return candidate.id === configuration.item_id;
  });
  return item
    ? {
        itemId: item.id,
        thresholdPercentage: configuration.threshold_percentage,
      }
    : undefined;
}

function captureConfiguration(
  configuration: BootstrapCaptureConfiguration | null,
  items: Array<CaptureItemResource>,
): CaptureConfigurationResource | undefined {
  if (!configuration) {
    return undefined;
  }
  const item = items.find(function configuredItem(candidate): boolean {
    return candidate.id === configuration.item_id;
  });
  const rarities = configuration.rarities.filter(isCaptureRarity);
  return item && rarities.length > 0 ? { itemId: item.id, rarities } : undefined;
}

async function loadHuntBootstrap(
  client: SupabaseClient,
  characterId: string,
): Promise<HuntBootstrap> {
  const parameters = { target_character_id: characterId };
  const { data, error } = await client.rpc('load_hunt_bootstrap', parameters);
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('hunt_bootstrap_character_not_found');
  }
  return data as HuntBootstrap;
}

function staticAbility(
  row: AbilityRow,
  effectsByMove: Map<number, Array<HuntStatEffectResource>>,
  typeSlugs: Map<number, string>,
  assignment: AbilityAssignment,
): HuntAbilityResource {
  return {
    accuracy: row.accuracy,
    areaRadius: Math.max(row.area_radius, row.area_length, row.area_width),
    category: row.category,
    cooldownMs: row.cooldown_ms,
    effects: effectsByMove.get(row.id) ?? [],
    id: row.id,
    isFire: typeSlugs.get(row.type_id) === 'fire',
    name: row.name,
    power: row.power,
    rangeTiles: row.range_tiles,
    requiredLevel: assignment.requiredLevel,
    slot: assignment.slot,
    target: row.target,
    typeId: row.type_id,
    typeSlug: typeSlugs.get(row.type_id) ?? 'normal',
  };
}

function staticAbilities(
  assignments: Array<AbilityAssignment>,
  abilityTemplates: Map<number, HuntAbilityResource>,
): Array<HuntAbilityResource> {
  const abilities: Array<HuntAbilityResource> = [];
  for (const assignment of assignments) {
    const ability = abilityTemplates.get(assignment.abilityId);
    if (ability) {
      abilities.push({
        ...ability,
        requiredLevel: assignment.requiredLevel,
        slot: assignment.slot,
      });
    }
  }
  return abilities;
}

function staticCatalog(client: SupabaseClient): Promise<StaticHuntCatalog> {
  async function load(): Promise<StaticHuntCatalog> {
    const queries = [
      client
        .from('evolutions')
        .select('from_species_id, to_species_id, required_level')
        .eq('trigger', 'level'),
      client.from('natures').select('slug, increased_stat, decreased_stat'),
      client
        .from('hunting_location_species')
        .select('hunting_location_id, species_id, minimum_level, maximum_level, encounter_weight'),
      client
        .from('species')
        .select(
          'id, name, base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed, ev_yield_hp, ev_yield_attack, ev_yield_defense, ev_yield_special_attack, ev_yield_special_defense, ev_yield_speed',
        ),
      client
        .from('species_move_learnsets')
        .select('species_id, move_id, required_level')
        .eq('learn_method', 'level'),
      client.from('species_types').select('species_id, type_id'),
      client
        .from('moves')
        .select(
          'id, name, category, type_id, power, accuracy, cooldown_ms, range_tiles, area_radius, area_length, area_width, area_shape, target',
        ),
      client.from('move_stat_effects').select('move_id, stat, stage, chance, target'),
      client.from('types').select('id, slug'),
      client.from('type_effectiveness').select('attacker_type_id, defender_type_id, multiplier'),
    ];
    const results = await Promise.all(queries);
    for (const result of results) {
      if (result.error) {
        throw result.error;
      }
    }
    const [
      evolutionResult,
      natureResult,
      encounterResult,
      speciesResult,
      speciesMoveResult,
      speciesTypeResult,
      abilityResult,
      effectResult,
      typeResult,
      typeEffectivenessResult,
    ] = results;
    const naturesBySlug = new Map<string, HuntNatureResource>();
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
      naturesBySlug.set(row.slug, { decreasedStat, increasedStat, slug: row.slug });
    }
    const effectsByMove = new Map<number, Array<HuntStatEffectResource>>();
    for (const row of effectResult.data as Array<MoveStatEffectRow>) {
      const stat = databaseStat(row.stat);
      if (!stat) {
        continue;
      }
      const effects = effectsByMove.get(row.move_id) ?? [];
      effects.push({ chance: row.chance, stage: row.stage, stat, target: row.target });
      effectsByMove.set(row.move_id, effects);
    }
    const typeSlugs = new Map<number, string>();
    for (const row of typeResult.data as Array<TypeRow>) {
      typeSlugs.set(row.id, row.slug);
    }
    const abilityTemplates = new Map<number, HuntAbilityResource>();
    const defaultAssignment = { abilityId: 0, requiredLevel: 0, slot: 0 };
    for (const row of abilityResult.data as Array<AbilityRow>) {
      abilityTemplates.set(row.id, staticAbility(row, effectsByMove, typeSlugs, defaultAssignment));
    }
    const assignmentsBySpecies = new Map<number, Array<AbilityAssignment>>();
    for (const row of speciesMoveResult.data as Array<SpeciesMoveRow>) {
      const assignments = assignmentsBySpecies.get(row.species_id) ?? [];
      assignments.push({
        abilityId: row.move_id,
        requiredLevel: row.required_level,
        slot: row.move_id,
      });
      assignmentsBySpecies.set(row.species_id, assignments);
    }
    for (const assignments of assignmentsBySpecies.values()) {
      assignments.sort(function sortByAbility(first, second): number {
        return first.abilityId - second.abilityId;
      });
    }
    const typeIdsBySpecies = new Map<number, Array<number>>();
    for (const row of speciesTypeResult.data as Array<SpeciesTypeRow>) {
      const typeIds = typeIdsBySpecies.get(row.species_id) ?? [];
      typeIds.push(row.type_id);
      typeIdsBySpecies.set(row.species_id, typeIds);
    }
    const species: Record<string, HuntSpeciesResource> = {};
    for (const row of speciesResult.data as Array<SpeciesRow>) {
      const typeIds = typeIdsBySpecies.get(row.id) ?? [];
      const assignments = assignmentsBySpecies.get(row.id) ?? [];
      species[String(row.id)] = {
        abilities: staticAbilities(assignments, abilityTemplates),
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
        typeIds,
        typeSlugs: typeIds.map(function typeSlug(typeId): string {
          return typeSlugs.get(typeId) ?? 'normal';
        }),
      };
    }
    const encountersByLocation = new Map<number, Array<HuntEncounterResource>>();
    for (const row of encounterResult.data as Array<HuntingLocationSpeciesRow>) {
      const encounters = encountersByLocation.get(row.hunting_location_id) ?? [];
      encounters.push({
        maximumLevel: row.maximum_level,
        minimumLevel: row.minimum_level,
        speciesId: row.species_id,
        weight: row.encounter_weight,
      });
      encountersByLocation.set(row.hunting_location_id, encounters);
    }
    const typeEffectiveness: Record<string, number> = {};
    for (const row of typeEffectivenessResult.data as Array<TypeEffectivenessRow>) {
      typeEffectiveness[row.attacker_type_id + ':' + row.defender_type_id] = row.multiplier;
    }
    const evolutions = (evolutionResult.data as Array<EvolutionRow>).map(function evolution(
      row: EvolutionRow,
    ): HuntEvolutionResource {
      return {
        fromSpeciesId: row.from_species_id,
        requiredLevel: row.required_level,
        toSpeciesId: row.to_species_id,
      };
    });
    return {
      abilityTemplates,
      encountersByLocation,
      evolutions,
      naturesBySlug,
      species,
      typeEffectiveness,
    };
  }
  return loadCatalog('hunt-static-catalog', load);
}

export async function loadHuntResources(
  client: SupabaseClient,
  characterId: string,
  locationId: number,
): Promise<HuntResources> {
  const queries = [
    loadHuntBootstrap(client, characterId),
    loadHealingItems(client),
    loadCaptureItems(client),
    staticCatalog(client),
  ];
  const [bootstrap, healingItems, captureItems, catalog] = await Promise.all(queries);
  const creatureRows = bootstrap.creatures;
  const encounters = catalog.encountersByLocation.get(locationId) ?? [];
  if (creatureRows.length === 0) {
    throw new Error('no_active_creatures');
  }
  if (encounters.length === 0) {
    throw new Error('hunting_location_has_no_species');
  }
  const equipped = bootstrap.equipped_moves;
  const creatures: Array<HuntCreatureResource> = [];
  for (const row of creatureRows) {
    const equippedAbilities = equipped.filter(function forCreature(
      assignment: EquippedAbilityRow,
    ): boolean {
      return assignment.creature_id === row.id;
    });
    const species = catalog.species[String(row.species_id)];
    if (!species) {
      throw new TypeError('creature_species_missing');
    }
    const levelByAbilityId = new Map<number, number>();
    for (const ability of species.abilities) {
      levelByAbilityId.set(ability.id, ability.requiredLevel);
    }
    const assignments = equippedAbilities.flatMap(function equippedMove(
      assignment: EquippedAbilityRow,
    ): Array<AbilityAssignment> {
      const requiredLevel = levelByAbilityId.get(assignment.move_id);
      return requiredLevel === undefined
        ? []
        : [{ abilityId: assignment.move_id, requiredLevel, slot: assignment.slot }];
    });
    const nature = catalog.naturesBySlug.get(row.nature_slug);
    if (!nature) {
      throw new TypeError('creature_nature_missing');
    }
    creatures.push({
      abilities: staticAbilities(assignments, catalog.abilityTemplates),
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
  return {
    activeCreatureId: bootstrap.active_creature_id,
    captureConfiguration: captureConfiguration(bootstrap.capture_configuration, captureItems),
    captureItems,
    character: {
      avatarUrl: bootstrap.avatar_url,
      level: bootstrap.level,
      name: bootstrap.name,
    },
    creatures,
    encounters,
    evolutions: catalog.evolutions,
    gold: bootstrap.gold,
    healingConfiguration: healingConfiguration(bootstrap.healing_configuration, healingItems),
    healingItems,
    locationId,
    species: catalog.species,
    typeEffectiveness: catalog.typeEffectiveness,
  };
}
