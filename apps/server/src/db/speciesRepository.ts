import type { Species, StarterSpecies } from '@creatures/contracts/species';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapAbilitiesBySpecies, mapSpeciesRow, mapStarterSpeciesRows } from '~/db/mappers';
import { readRows } from '~/db/trainerRepository';
import type { SpeciesAbilityRow, SpeciesRow } from '~/db/types';

const SPECIES_COLUMNS =
  'id, slug, name, element, description, base_vitality, base_physical_attack, base_magic_attack, base_physical_defense, base_magic_defense, capture_chance, base_experience, is_starter';
const SPECIES_ABILITY_COLUMNS =
  'species_id, slot, abilities(id, slug, name, element, damage, cooldown_ms, description)';

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export function listStarterSpecies(admin: SupabaseClient): Promise<StarterSpecies[]> {
  return listStarterSpeciesRows(admin).then(readSpeciesAbilities(admin));
}

function listStarterSpeciesRows(admin: SupabaseClient): Promise<SpeciesRow[]> {
  const query = admin
    .from('species')
    .select(SPECIES_COLUMNS)
    .eq('is_starter', true)
    .order('name', { ascending: true });
  return Promise.resolve(query.then(readSpeciesRows));
}

function readSpeciesAbilities(
  admin: SupabaseClient,
): (speciesRows: SpeciesRow[]) => Promise<StarterSpecies[]> {
  return function loadAbilities(speciesRows: SpeciesRow[]): Promise<StarterSpecies[]> {
    return listSpeciesAbilities(admin, speciesRows.map(readSpeciesId)).then(function buildStarters(
      abilityRows: SpeciesAbilityRow[],
    ): StarterSpecies[] {
      const abilitiesBySpecies = mapAbilitiesBySpecies(abilityRows);
      return mapStarterSpeciesRows(speciesRows, abilitiesBySpecies);
    });
  };
}

function listSpeciesAbilities(
  admin: SupabaseClient,
  speciesIds: string[],
): Promise<SpeciesAbilityRow[]> {
  if (speciesIds.length === 0) {
    return Promise.resolve([]);
  }
  const query = admin
    .from('species_abilities')
    .select(SPECIES_ABILITY_COLUMNS)
    .in('species_id', speciesIds)
    .order('slot', { ascending: true });
  return Promise.resolve(query.then(readAbilityRows));
}

function readSpeciesRows(result: QueryResult<SpeciesRow[]>): SpeciesRow[] {
  return readRows<SpeciesRow>(result.data, result.error);
}

function readAbilityRows(result: QueryResult<SpeciesAbilityRow[]>): SpeciesAbilityRow[] {
  return readRows<SpeciesAbilityRow>(result.data, result.error);
}

function readSpeciesId(row: SpeciesRow): string {
  return row.id;
}

/**
 * One species, with the abilities it declares.
 *
 * A creature carries the base values of its species, but not the abilities:
 * the set of abilities belongs to the species, and the interface opens the
 * details of a creature that can be in the storage, out of the team.
 */
export function findSpeciesById(admin: SupabaseClient, speciesId: string): Promise<Species | null> {
  const query = admin.from('species').select(SPECIES_COLUMNS).eq('id', speciesId).maybeSingle();
  return Promise.resolve(query.then(readSpeciesRow)).then(function withAbilities(
    row: SpeciesRow | null,
  ): Species | null | Promise<Species | null> {
    if (row === null) {
      return null;
    }
    return listAbilities(admin, speciesId).then(function buildSpecies(
      abilityRows: SpeciesAbilityRow[],
    ): Species {
      const abilitiesBySpecies = mapAbilitiesBySpecies(abilityRows);
      return mapSpeciesRow(row, abilitiesBySpecies.get(speciesId) ?? []);
    });
  });
}

function listAbilities(admin: SupabaseClient, speciesId: string): Promise<SpeciesAbilityRow[]> {
  const query = admin
    .from('species_abilities')
    .select(SPECIES_ABILITY_COLUMNS)
    .eq('species_id', speciesId)
    .order('slot', { ascending: true });
  return Promise.resolve(query.then(readAbilityRows));
}

function readSpeciesRow(result: QueryResult<SpeciesRow>): SpeciesRow | null {
  if (result.error !== null) {
    throw new Error(`Species lookup failed: ${result.error.message}`);
  }
  return result.data;
}
