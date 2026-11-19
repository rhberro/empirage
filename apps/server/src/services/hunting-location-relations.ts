/* eslint-disable oxsome/no-inline-structural-types */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '../errors.ts';
import type {
  UpdateHuntingLocationSpeciesInput,
  UpdateHuntingLocationWaveRangeInput,
} from './hunting-locations.ts';

function databaseError(error: PostgrestError): AppError {
  return new AppError(500, 'database_error', error);
}

export async function fetchMaxLocationId(supabase: SupabaseClient): Promise<number> {
  const { data: maxIdRow, error: maxIdErr } = await supabase
    .from('hunting_locations')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxIdErr) {
    throw databaseError(maxIdErr);
  }
  return maxIdRow ? maxIdRow.id : 0;
}

export async function updateLocationSpecies(
  supabase: SupabaseClient,
  locationId: number,
  speciesList?: Array<UpdateHuntingLocationSpeciesInput>,
): Promise<void> {
  if (speciesList === undefined) {
    return;
  }
  const { error: delErr } = await supabase
    .from('hunting_location_species')
    .delete()
    .eq('hunting_location_id', locationId);
  if (delErr) {
    throw databaseError(delErr);
  }
  if (speciesList.length === 0) {
    return;
  }
  function mapSpeciesRow(item: UpdateHuntingLocationSpeciesInput): Record<string, unknown> {
    return {
      encounter_weight: item.encounterWeight,
      hunting_location_id: locationId,
      maximum_level: item.maximumLevel,
      minimum_level: item.minimumLevel,
      slot: item.slot,
      species_id: item.speciesId,
    };
  }
  const rows = speciesList.map(mapSpeciesRow);
  const { error: insErr } = await supabase.from('hunting_location_species').insert(rows);
  if (insErr) {
    throw databaseError(insErr);
  }
}

export async function updateLocationWaveRanges(
  supabase: SupabaseClient,
  locationId: number,
  waveRangeList?: Array<UpdateHuntingLocationWaveRangeInput>,
): Promise<void> {
  if (waveRangeList === undefined) {
    return;
  }
  const { error: delErr } = await supabase
    .from('hunting_location_wave_ranges')
    .delete()
    .eq('hunting_location_id', locationId);
  if (delErr) {
    throw databaseError(delErr);
  }
  if (waveRangeList.length === 0) {
    return;
  }
  function mapWaveRow(item: UpdateHuntingLocationWaveRangeInput): Record<string, unknown> {
    return {
      hunting_location_id: locationId,
      maximum_size: item.maximumSize,
      minimum_size: item.minimumSize,
    };
  }
  const rows = waveRangeList.map(mapWaveRow);
  const { error: insErr } = await supabase.from('hunting_location_wave_ranges').insert(rows);
  if (insErr) {
    throw databaseError(insErr);
  }
}
