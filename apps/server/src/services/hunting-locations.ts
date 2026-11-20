/* eslint-disable oxsome/no-inline-structural-types */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '../errors.ts';
import {
  fetchMaxLocationId,
  updateLocationSpecies,
  updateLocationWaveRanges,
} from './hunting-location-relations.ts';
import type {
  CreateHuntingLocationInput,
  HuntingLocation,
  HuntingLocationAnimation,
  HuntingLocationMap,
  HuntingLocationMapLayer,
  HuntingLocationMapObject,
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
  HuntingLocationSpecies,
  HuntingLocationSpeciesList,
  HuntingLocationWaveRange,
  HuntingLocationWaveRangeList,
  SpeciesCatalogItem,
  UpdateHuntingLocationSpeciesInput,
  UpdateHuntingLocationWaveRangeInput,
} from './hunting-location-types.ts';

export type {
  CreateHuntingLocationInput,
  HuntingLocation,
  HuntingLocationAnimation,
  HuntingLocationMap,
  HuntingLocationMapLayer,
  HuntingLocationMapObject,
  HuntingLocationMapTile,
  HuntingLocationSpecialTile,
  HuntingLocationSpecies,
  HuntingLocationSpeciesList,
  HuntingLocationWaveRange,
  HuntingLocationWaveRangeList,
  SpeciesCatalogItem,
  UpdateHuntingLocationSpeciesInput,
  UpdateHuntingLocationWaveRangeInput,
};

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
    slot: availability.slot,
  };
  return species;
}

function mapWaveRange(range: HuntingLocationWaveRangeRow): HuntingLocationWaveRange {
  return { maximumSize: range.maximum_size, minimumSize: range.minimum_size };
}

function normalizeMapData(rawMap: HuntingLocationMap): HuntingLocationMap {
  const mapData = { ...rawMap };
  if (!mapData.layers || mapData.layers.length === 0) {
    const defaultLayer: HuntingLocationMapLayer = {
      id: 'layer-0',
      name: 'Ground (Base)',
      order: 0,
      placement: 'below_characters',
      tiles: mapData.tiles || [],
      visible: true,
    };
    mapData.layers = [defaultLayer];
  }
  return mapData;
}

function mapHuntingLocation(location: HuntingLocationRow): HuntingLocation {
  const species = location.hunting_location_species.map(mapSpecies);
  const waveRanges = location.hunting_location_wave_ranges.map(mapWaveRange);
  const huntingLocation = {
    description: location.description,
    id: location.id,
    map: normalizeMapData(location.map_data),
    name: location.name,
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
      'id, slug, name, description, tileset_url, map_data, hunting_location_species(slot, minimum_level, maximum_level, encounter_weight, species(id, name, description)), hunting_location_wave_ranges(minimum_size, maximum_size)',
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

export async function listSpeciesCatalog(
  supabase: SupabaseClient,
): Promise<Array<SpeciesCatalogItem>> {
  const { data, error } = await supabase
    .from('species')
    .select('id, name, description')
    .order('id');

  if (error) {
    throw databaseError(error);
  }

  return (data as Array<SpeciesCatalogItem>) ?? [];
}

export async function createHuntingLocation(
  supabase: SupabaseClient,
  input: CreateHuntingLocationInput,
): Promise<HuntingLocation> {
  const maxId = await fetchMaxLocationId(supabase);
  const nextId = maxId + 1;
  const insertPayload = {
    description: input.description,
    id: nextId,
    map_data: input.mapData,
    name: input.name,
    slug: input.slug,
    tileset_url: input.tilesetUrl ?? '/assets/tilesets/exterior.png',
    wave_delay_seconds: 3,
  };

  const { error: insLocErr } = await supabase.from('hunting_locations').insert(insertPayload);
  if (insLocErr) {
    throw databaseError(insLocErr);
  }

  await updateLocationSpecies(supabase, nextId, input.speciesList);
  await updateLocationWaveRanges(supabase, nextId, input.waveRangesList);

  const { data, error } = await supabase
    .from('hunting_locations')
    .select(
      'id, slug, name, description, tileset_url, map_data, hunting_location_species(slot, minimum_level, maximum_level, encounter_weight, species(id, name, description)), hunting_location_wave_ranges(minimum_size, maximum_size)',
    )
    .eq('id', nextId)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }
  if (!data) {
    throw new AppError(500, 'hunting_location_create_failed');
  }

  return mapHuntingLocation(data as HuntingLocationRow);
}

export async function updateHuntingLocationMap(
  supabase: SupabaseClient,
  locationId: number,
  mapData: HuntingLocationMap,
  tilesetUrl?: string,
  speciesList?: Array<UpdateHuntingLocationSpeciesInput>,
  waveRangeList?: Array<UpdateHuntingLocationWaveRangeInput>,
): Promise<HuntingLocation> {
  const updatePayload: Record<string, unknown> = { map_data: mapData };
  if (tilesetUrl) {
    updatePayload.tileset_url = tilesetUrl;
  }

  const { error: locError } = await supabase
    .from('hunting_locations')
    .update(updatePayload)
    .eq('id', locationId);

  if (locError) {
    throw databaseError(locError);
  }

  await updateLocationSpecies(supabase, locationId, speciesList);
  await updateLocationWaveRanges(supabase, locationId, waveRangeList);

  const { data, error } = await supabase
    .from('hunting_locations')
    .select(
      'id, slug, name, description, tileset_url, map_data, hunting_location_species(slot, minimum_level, maximum_level, encounter_weight, species(id, name, description)), hunting_location_wave_ranges(minimum_size, maximum_size)',
    )
    .eq('id', locationId)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }
  if (!data) {
    throw new AppError(404, 'hunting_location_not_found');
  }

  return mapHuntingLocation(data as HuntingLocationRow);
}
