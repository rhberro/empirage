import type { HuntAreaDetail, HuntAreaItem, HuntAreaSpecies } from '@creatures/contracts/hunt';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  mapHuntAreaItem,
  mapHuntAreaRow,
  sortHuntAreasByRecommendedLevel,
} from '~/db/huntAreaMappers';
import { readRows } from '~/db/trainerRepository';
import type { HuntAreaItemRow, HuntAreaListEntry, HuntAreaRow } from '~/db/types';

const HUNT_AREA_COLUMNS =
  'id, slug, name, description, recommended_level, minimum_level, tone, hunt_area_species(position, is_primary, species(id, slug, name, element))';
const DROP_COLUMNS =
  'species_id, items(id, slug, name, category, description, price, is_store_item)';

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

/**
 * The areas, from the lowest recommended level to the highest.
 *
 * The order is the server's decision: the client only shows the list the way it
 * arrives.
 */
export function listHuntAreas(admin: SupabaseClient): Promise<HuntAreaListEntry[]> {
  const query = admin
    .from('hunt_areas')
    .select(HUNT_AREA_COLUMNS)
    .order('recommended_level', { ascending: true })
    .order('slug', { ascending: true });
  return Promise.resolve(
    query.then(readAreaRows).then(mapAreaRows).then(sortHuntAreasByRecommendedLevel),
  );
}

export function findHuntAreaById(
  admin: SupabaseClient,
  huntAreaId: string,
): Promise<HuntAreaDetail | null> {
  const query = admin
    .from('hunt_areas')
    .select(HUNT_AREA_COLUMNS)
    .eq('id', huntAreaId)
    .maybeSingle();
  return Promise.resolve(query.then(readSingleArea)).then(function readItems(
    row: HuntAreaRow | null,
  ): HuntAreaDetail | null | Promise<HuntAreaDetail> {
    if (row === null) {
      return null;
    }
    return loadAreaItems(admin, mapHuntAreaRow(row));
  });
}

function loadAreaItems(admin: SupabaseClient, area: HuntAreaListEntry): Promise<HuntAreaDetail> {
  const speciesIds = area.species.map(readSpeciesId);
  return listAreaItems(admin, speciesIds).then(function withItems(
    items: HuntAreaItem[],
  ): HuntAreaDetail {
    return { ...area, items };
  });
}

/**
 * The items of an area are the union of the drops of its species: the area
 * shows everything that can be found there, not what one creature leaves
 * behind.
 */
function listAreaItems(admin: SupabaseClient, speciesIds: string[]): Promise<HuntAreaItem[]> {
  if (speciesIds.length === 0) {
    return Promise.resolve([]);
  }
  const query = admin.from('species_drops').select(DROP_COLUMNS).in('species_id', speciesIds);
  return Promise.resolve(query.then(readDropRows).then(unionItems));
}

function unionItems(rows: HuntAreaItemRow[]): HuntAreaItem[] {
  const items = new Map<string, HuntAreaItem>();
  for (const row of rows) {
    const item = mapHuntAreaItem(row);
    if (item !== null) {
      items.set(item.itemId, item);
    }
  }
  return [...items.values()].toSorted(compareItemsByName);
}

function compareItemsByName(first: HuntAreaItem, second: HuntAreaItem): number {
  return first.name.localeCompare(second.name, 'pt-BR');
}

function readSpeciesId(entry: HuntAreaSpecies): string {
  return entry.species.id;
}

function mapAreaRows(rows: HuntAreaRow[]): HuntAreaListEntry[] {
  return rows.map(mapHuntAreaRow);
}

function readAreaRows(result: QueryResult<HuntAreaRow[]>): HuntAreaRow[] {
  return readRows<HuntAreaRow>(result.data, result.error);
}

function readSingleArea(result: QueryResult<HuntAreaRow>): HuntAreaRow | null {
  if (result.error !== null) {
    throw new Error(`Hunt area lookup failed: ${result.error.message}`);
  }
  return result.data === null ? null : result.data;
}

function readDropRows(result: QueryResult<HuntAreaItemRow[]>): HuntAreaItemRow[] {
  return readRows<HuntAreaItemRow>(result.data, result.error);
}
