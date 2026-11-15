/* eslint-disable oxsome/no-inline-structural-types */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '../errors.ts';

export interface HuntingLocation {
  description: string;
  id: number;
  map: HuntingLocationMap;
  name: string;
  positionX: number;
  positionY: number;
  slug: string;
  species: HuntingLocationSpeciesList;
  tilesetUrl: string;
  waveRanges: HuntingLocationWaveRangeList;
}

interface HuntingLocationMapTile {
  frame: number;
  x: number;
  y: number;
}

interface HuntingLocationMapObject {
  kind: string;
  x: number;
  y: number;
}

interface HuntingLocationMap {
  defaultTileFrame: number;
  height: number;
  objects: Array<HuntingLocationMapObject>;
  tileSize: number;
  tiles: Array<HuntingLocationMapTile>;
  width: number;
}

interface HuntingLocationSpecies {
  description: string;
  encounterWeight: number;
  id: number;
  maximumLevel: number;
  minimumLevel: number;
  name: string;
}

type HuntingLocationSpeciesList = Array<HuntingLocationSpecies>;
interface HuntingLocationWaveRange {
  maximumSize: number;
  minimumSize: number;
}
type HuntingLocationWaveRangeList = Array<HuntingLocationWaveRange>;

interface SpeciesRow {
  description: string;
  id: number;
  name: string;
}

interface HuntingLocationSpeciesRow {
  species: SpeciesRow;
  encounter_weight: number;
  maximum_level: number;
  minimum_level: number;
  slot: number;
}

type HuntingLocationSpeciesRowList = Array<HuntingLocationSpeciesRow>;

interface HuntingLocationRow {
  description: string;
  hunting_location_species: HuntingLocationSpeciesRowList;
  hunting_location_wave_ranges: HuntingLocationWaveRangeRowList;
  id: number;
  map_data: HuntingLocationMap;
  name: string;
  position_x: number;
  position_y: number;
  slug: string;
  tileset_url: string;
}
interface HuntingLocationWaveRangeRow {
  maximum_size: number;
  minimum_size: number;
}
type HuntingLocationWaveRangeRowList = Array<HuntingLocationWaveRangeRow>;

type HuntingLocationList = Array<HuntingLocation>;
type HuntingLocationRowList = Array<HuntingLocationRow>;

function databaseError(error: PostgrestError): AppError {
  return new AppError(500, 'database_error', error);
}

function mapSpecies(availability: HuntingLocationSpeciesRow): HuntingLocationSpecies {
  const species = {
    description: availability.species.description,
    encounterWeight: availability.encounter_weight,
    id: availability.species.id,
    maximumLevel: availability.maximum_level,
    minimumLevel: availability.minimum_level,
    name: availability.species.name,
  };
  return species;
}

function mapWaveRange(range: HuntingLocationWaveRangeRow): HuntingLocationWaveRange {
  return { maximumSize: range.maximum_size, minimumSize: range.minimum_size };
}

function mapHuntingLocation(location: HuntingLocationRow): HuntingLocation {
  const species = location.hunting_location_species.map(mapSpecies);
  const waveRanges = location.hunting_location_wave_ranges.map(mapWaveRange);
  const huntingLocation = {
    description: location.description,
    id: location.id,
    map: location.map_data,
    name: location.name,
    positionX: location.position_x,
    positionY: location.position_y,
    slug: location.slug,
    species,
    tilesetUrl: location.tileset_url,
    waveRanges,
  };
  return huntingLocation;
}

export async function listHuntingLocations(supabase: SupabaseClient): Promise<HuntingLocationList> {
  const speciesOrder = { referencedTable: 'hunting_location_species' };
  const waveRangeOrder = { referencedTable: 'hunting_location_wave_ranges' };
  const { data, error } = await supabase
    .from('hunting_locations')
    .select(
      'id, slug, name, description, position_x, position_y, tileset_url, map_data, hunting_location_species(slot, minimum_level, maximum_level, encounter_weight, species(id, name, description)), hunting_location_wave_ranges(minimum_size, maximum_size)',
    )
    .order('id')
    .order('slot', speciesOrder)
    .order('minimum_size', waveRangeOrder)
    .order('maximum_size', waveRangeOrder);

  if (error) {
    throw databaseError(error);
  }

  return (data as HuntingLocationRowList).map(mapHuntingLocation);
}
