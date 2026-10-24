import type { Element } from '@creatures/contracts/species';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readRows } from '~/db/trainerRepository';

/**
 * The reads of the hunt content and of the team.
 *
 * The module only returns rows: the translation to the simulation lives in the
 * mappers of the hunt, which are pure and can be tested without a database.
 */

export type HuntAreaRow = {
  id: string;
  minimum_level: number;
  name: string;
  recommended_level: number;
  slug: string;
};

export type HuntAbilityRow = {
  area_length: number | null;
  area_radius: number | null;
  area_shape: 'line' | 'circle' | null;
  area_step_ms: number;
  cooldown_ms: number;
  damage: number;
  element: Element;
  id: string;
  name: string;
  range: number;
  slug: string;
  target_type: 'area' | 'area_self' | 'target';
  travel_ms: number;
};

export type HuntSpeciesRow = {
  base_experience: number;
  base_magic_attack: number;
  base_magic_defense: number;
  base_physical_attack: number;
  base_physical_defense: number;
  base_vitality: number;
  capture_chance: number;
  element: Element;
  id: string;
  name: string;
  slug: string;
};

export type HuntSpeciesAbilityRow = {
  abilities: HuntAbilityRow | HuntAbilityRow[] | null;
  slot: number;
  species_id: string;
  wild_chance: number;
  wild_interval_ms: number;
};

export type HuntDropRow = {
  chance: number;
  items: { id: string; name: string } | { id: string; name: string }[] | null;
  species_id: string;
};

export type HuntEffectivenessRow = {
  attacker_element: Element;
  defender_element: Element;
  multiplier: number;
};

export type HuntCreatureRow = {
  current_hp: number | null;
  experience: number;
  id: string;
  level: number;
  potential: unknown;
  species: HuntSpeciesRow | HuntSpeciesRow[] | null;
  team_slot: number | null;
  trainer_id: string;
};

export type HuntEquippedAbilityRow = {
  abilities: HuntAbilityRow | HuntAbilityRow[] | null;
  creature_id: string;
  slot: number;
};

export type HuntGearItemRow = {
  capture_multiplier: number;
  cooldown_ms: number;
  heal_percent: number | null;
  id: string;
  name: string;
};

export type HuntGearSlotRow = {
  item_id: string;
  items: HuntGearItemRow | HuntGearItemRow[] | null;
  kind: string;
  slot: number;
  trigger_hp_percent: number | null;
};

export type HuntTrainerRow = {
  level: number;
  stamina_minutes: number;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

const HUNT_AREA_COLUMNS = 'id, slug, name, minimum_level, recommended_level';
const SPECIES_COLUMNS =
  'id, slug, name, element, base_vitality, base_physical_attack, base_magic_attack, base_physical_defense, base_magic_defense, capture_chance, base_experience';
const ABILITY_FIELDS =
  'id, slug, name, element, damage, cooldown_ms, target_type, range, area_shape, area_length, area_radius, area_step_ms, travel_ms';
const SPECIES_ABILITY_COLUMNS = `species_id, slot, wild_chance, wild_interval_ms, abilities(${ABILITY_FIELDS})`;
const DROP_COLUMNS = 'species_id, chance, items(id, name)';
const EFFECTIVENESS_COLUMNS = 'attacker_element, defender_element, multiplier';
const CREATURE_COLUMNS = `id, team_slot, level, experience, potential, current_hp, species(${SPECIES_COLUMNS})`;
const EQUIPPED_ABILITY_COLUMNS = `creature_id, slot, abilities(${ABILITY_FIELDS})`;
const GEAR_SLOT_COLUMNS =
  'slot, kind, item_id, trigger_hp_percent, items(id, name, heal_percent, cooldown_ms, capture_multiplier)';

export function readHuntArea(admin: SupabaseClient, areaId: string): Promise<HuntAreaRow | null> {
  const query = admin.from('hunt_areas').select(HUNT_AREA_COLUMNS).eq('id', areaId).maybeSingle();
  return readSingle<HuntAreaRow>(query);
}

export function readAreaSpeciesIds(admin: SupabaseClient, areaId: string): Promise<string[]> {
  const query = admin
    .from('hunt_area_species')
    .select('species_id, position')
    .eq('hunt_area_id', areaId)
    .order('position', { ascending: true });
  return readList<{ species_id: string }>(query).then(function toIds(
    rows: { species_id: string }[],
  ): string[] {
    return rows.map(readAreaSpeciesId);
  });
}

export function readSpeciesByIds(admin: SupabaseClient, ids: string[]): Promise<HuntSpeciesRow[]> {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  const query = admin.from('species').select(SPECIES_COLUMNS).in('id', ids);
  return readList<HuntSpeciesRow>(query);
}

export function readSpeciesBySlugs(
  admin: SupabaseClient,
  slugs: string[],
): Promise<HuntSpeciesRow[]> {
  if (slugs.length === 0) {
    return Promise.resolve([]);
  }
  const query = admin.from('species').select(SPECIES_COLUMNS).in('slug', slugs);
  return readList<HuntSpeciesRow>(query);
}

export function readSpeciesAbilityRows(
  admin: SupabaseClient,
  speciesIds: string[],
): Promise<HuntSpeciesAbilityRow[]> {
  if (speciesIds.length === 0) {
    return Promise.resolve([]);
  }
  const query = admin
    .from('species_abilities')
    .select(SPECIES_ABILITY_COLUMNS)
    .in('species_id', speciesIds)
    .order('slot', { ascending: true });
  return readList<HuntSpeciesAbilityRow>(query);
}

export function readDropRows(admin: SupabaseClient, speciesIds: string[]): Promise<HuntDropRow[]> {
  if (speciesIds.length === 0) {
    return Promise.resolve([]);
  }
  const query = admin.from('species_drops').select(DROP_COLUMNS).in('species_id', speciesIds);
  return readList<HuntDropRow>(query);
}

export function readEffectivenessRows(admin: SupabaseClient): Promise<HuntEffectivenessRow[]> {
  const query = admin.from('type_effectiveness').select(EFFECTIVENESS_COLUMNS);
  return readList<HuntEffectivenessRow>(query);
}

export function readTeamRows(admin: SupabaseClient, trainerId: string): Promise<HuntCreatureRow[]> {
  const query = admin
    .from('creatures')
    .select(CREATURE_COLUMNS)
    .eq('trainer_id', trainerId)
    .eq('is_in_team', true)
    .order('team_slot', { ascending: true });
  return readList<HuntCreatureRow>(query);
}

export function readEquippedAbilityRows(
  admin: SupabaseClient,
  creatureIds: string[],
): Promise<HuntEquippedAbilityRow[]> {
  if (creatureIds.length === 0) {
    return Promise.resolve([]);
  }
  const query = admin
    .from('creature_ability_slots')
    .select(EQUIPPED_ABILITY_COLUMNS)
    .in('creature_id', creatureIds)
    .order('slot', { ascending: true });
  return readList<HuntEquippedAbilityRow>(query);
}

export function readGearSlotRows(
  admin: SupabaseClient,
  trainerId: string,
): Promise<HuntGearSlotRow[]> {
  const query = admin
    .from('trainer_gear_slots')
    .select(GEAR_SLOT_COLUMNS)
    .eq('trainer_id', trainerId)
    .order('slot', { ascending: true });
  return readList<HuntGearSlotRow>(query);
}

export function readTrainerLoad(
  admin: SupabaseClient,
  trainerId: string,
): Promise<HuntTrainerRow | null> {
  const query = admin
    .from('trainers')
    .select('level, stamina_minutes')
    .eq('id', trainerId)
    .maybeSingle();
  return readSingle<HuntTrainerRow>(query);
}

function readList<T>(query: PromiseLike<unknown>): Promise<T[]> {
  return Promise.resolve(query).then(function toRows(value: unknown): T[] {
    const result = value as QueryResult<T[]>;
    return readRows<T>(result.data, result.error);
  });
}

function readSingle<T>(query: PromiseLike<unknown>): Promise<T | null> {
  return Promise.resolve(query).then(function toRow(value: unknown): T | null {
    const result = value as QueryResult<T>;
    if (result.error !== null) {
      throw new Error(`Database query failed: ${result.error.message}`);
    }
    return result.data;
  });
}

function readAreaSpeciesId(row: { species_id: string }): string {
  return row.species_id;
}
