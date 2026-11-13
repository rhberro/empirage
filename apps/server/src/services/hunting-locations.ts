import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '../errors.ts';

export interface HuntingLocation {
  description: string;
  id: number;
  name: string;
  positionX: number;
  positionY: number;
  slug: string;
  species: HuntingLocationSpeciesList;
}

interface HuntingLocationSpecies {
  encounterWeight: number;
  id: number;
  maximumLevel: number;
  minimumLevel: number;
  name: string;
}

type HuntingLocationSpeciesList = Array<HuntingLocationSpecies>;

interface CreatureSpeciesRow {
  id: number;
  name: string;
}

interface HuntingLocationSpeciesRow {
  creature_species: CreatureSpeciesRow;
  encounter_weight: number;
  maximum_level: number;
  minimum_level: number;
  slot: number;
}

type HuntingLocationSpeciesRowList = Array<HuntingLocationSpeciesRow>;

interface HuntingLocationRow {
  description: string;
  hunting_location_species: HuntingLocationSpeciesRowList;
  id: number;
  name: string;
  position_x: number;
  position_y: number;
  slug: string;
}

type HuntingLocationList = Array<HuntingLocation>;
type HuntingLocationRowList = Array<HuntingLocationRow>;

function databaseError(error: PostgrestError): AppError {
  return new AppError(500, 'database_error', error);
}

function mapSpecies(availability: HuntingLocationSpeciesRow): HuntingLocationSpecies {
  const species = {
    encounterWeight: availability.encounter_weight,
    id: availability.creature_species.id,
    maximumLevel: availability.maximum_level,
    minimumLevel: availability.minimum_level,
    name: availability.creature_species.name,
  };
  return species;
}

function mapHuntingLocation(location: HuntingLocationRow): HuntingLocation {
  const species = location.hunting_location_species.map(mapSpecies);
  const huntingLocation = {
    description: location.description,
    id: location.id,
    name: location.name,
    positionX: location.position_x,
    positionY: location.position_y,
    slug: location.slug,
    species,
  };
  return huntingLocation;
}

export async function listHuntingLocations(supabase: SupabaseClient): Promise<HuntingLocationList> {
  const speciesOrder = { referencedTable: 'hunting_location_species' };
  const { data, error } = await supabase
    .from('hunting_locations')
    .select(
      'id, slug, name, description, position_x, position_y, hunting_location_species(slot, minimum_level, maximum_level, encounter_weight, creature_species(id, name))',
    )
    .order('id')
    .order('slot', speciesOrder);

  if (error) {
    throw databaseError(error);
  }

  return (data as HuntingLocationRowList).map(mapHuntingLocation);
}
