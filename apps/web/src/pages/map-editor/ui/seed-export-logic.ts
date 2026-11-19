/* eslint-disable oxsome/no-inline-structural-types */
import type {
  HuntingLocation,
  HuntingLocationMap,
  HuntingLocationSpecies,
  HuntingLocationWaveRange,
} from '~/entities/hunting-location';

import { cropMapTiles } from './map-editor-logic';

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

function buildLocationSql(
  location: HuntingLocation,
  croppedMap: HuntingLocationMap,
  tilesetUrl: string,
): string {
  const escapedName = escapeSqlString(location.name);
  const escapedSlug = escapeSqlString(location.slug);
  const escapedDesc = escapeSqlString(location.description || '');
  const escapedTileset = escapeSqlString(tilesetUrl);
  const mapJsonEscaped = escapeSqlString(JSON.stringify(croppedMap));

  return [
    '-- Hunting Location: ' + location.name,
    'insert into public.hunting_locations (id, slug, name, description, position_x, position_y, wave_delay_seconds, tileset_url, map_data)',
    `values (${location.id}, '${escapedSlug}', '${escapedName}', '${escapedDesc}', ${location.positionX}, ${location.positionY}, 3, '${escapedTileset}', '${mapJsonEscaped}'::jsonb)`,
    'on conflict (id) do update set',
    '  slug = excluded.slug,',
    '  name = excluded.name,',
    '  description = excluded.description,',
    '  tileset_url = excluded.tileset_url,',
    '  map_data = excluded.map_data;',
  ].join('\n');
}

function buildSpeciesRowSql(locationId: number, s: HuntingLocationSpecies): string {
  const slot = s.slot ?? 1;
  return `  (${locationId}, ${s.id}, ${slot}, ${s.minimumLevel}, ${s.maximumLevel}, ${s.encounterWeight})`;
}

function buildSpeciesSql(locationId: number, speciesList: Array<HuntingLocationSpecies>): string {
  if (speciesList.length === 0) {
    return '';
  }
  function mapRow(s: HuntingLocationSpecies): string {
    return buildSpeciesRowSql(locationId, s);
  }
  const rows = speciesList.map(mapRow);
  return [
    'insert into public.hunting_location_species (hunting_location_id, species_id, slot, minimum_level, maximum_level, encounter_weight) values',
    rows.join(',\n'),
    'on conflict (hunting_location_id, species_id) do update set',
    '  slot = excluded.slot,',
    '  minimum_level = excluded.minimum_level,',
    '  maximum_level = excluded.maximum_level,',
    '  encounter_weight = excluded.encounter_weight;',
  ].join('\n');
}

function buildWaveRowSql(locationId: number, w: HuntingLocationWaveRange): string {
  return `  (${locationId}, ${w.minimumSize}, ${w.maximumSize})`;
}

function buildWaveRangesSql(
  locationId: number,
  waveRanges: Array<HuntingLocationWaveRange>,
): string {
  if (waveRanges.length === 0) {
    return '';
  }
  function mapRow(w: HuntingLocationWaveRange): string {
    return buildWaveRowSql(locationId, w);
  }
  const rows = waveRanges.map(mapRow);
  return [
    'insert into public.hunting_location_wave_ranges (hunting_location_id, minimum_size, maximum_size) values',
    rows.join(',\n'),
    'on conflict (hunting_location_id, minimum_size, maximum_size) do nothing;',
  ].join('\n');
}

export function generateHuntingLocationSeedSql(
  location: HuntingLocation,
  map: HuntingLocationMap,
  tilesetUrl: string,
  speciesList?: Array<HuntingLocationSpecies>,
  waveRanges?: Array<HuntingLocationWaveRange>,
): string {
  const croppedMap = cropMapTiles(map);
  const sections: Array<string> = [buildLocationSql(location, croppedMap, tilesetUrl)];

  if (speciesList && speciesList.length > 0) {
    sections.push(buildSpeciesSql(location.id, speciesList));
  }

  if (waveRanges && waveRanges.length > 0) {
    sections.push(buildWaveRangesSql(location.id, waveRanges));
  }

  return sections.join('\n\n') + '\n';
}
