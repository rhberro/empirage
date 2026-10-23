import type { HuntAreaItem, HuntAreaSpecies } from '@creatures/contracts/hunt';

import { readEmbedded } from '~/db/embedded';
import { areaTone, itemTone, speciesTone } from '~/db/tones';
import type {
  HuntAreaItemRow,
  HuntAreaListEntry,
  HuntAreaRow,
  HuntAreaSpeciesRow,
} from '~/db/types';

const EMPTY_SPECIES: HuntAreaSpecies = {
  species: { element: 'neutral', id: '', name: '', slug: '' },
  tone: 'neutral',
};

type HuntAreaSpeciesEntry = {
  isPrimary: boolean;
  species: HuntAreaSpecies;
};

export function mapHuntAreaRow(row: HuntAreaRow): HuntAreaListEntry {
  const entries = row.hunt_area_species.toSorted(compareHuntAreaSpeciesRows).map(mapEntry);
  const species = entries.map(readEntrySpecies);
  const primary = entries.find(readPrimaryEntry)?.species ?? species[0] ?? EMPTY_SPECIES;
  return {
    description: row.description,
    id: row.id,
    minimumLevel: row.minimum_level,
    name: row.name,
    primarySpecies: primary,
    recommendedLevel: row.recommended_level,
    slug: row.slug,
    species,
    tone: areaTone(row.tone),
  };
}

export function mapHuntAreaSpecies(row: HuntAreaSpeciesRow): HuntAreaSpecies {
  const species = readEmbedded(row.species);
  if (species === null) {
    return EMPTY_SPECIES;
  }
  return {
    species: { element: species.element, id: species.id, name: species.name, slug: species.slug },
    tone: speciesTone(species.element),
  };
}

export function mapHuntAreaItem(row: HuntAreaItemRow): HuntAreaItem | null {
  const item = readEmbedded(row.items);
  if (item === null) {
    return null;
  }
  return {
    category: item.category,
    description: item.description,
    isStoreItem: item.is_store_item,
    itemId: item.id,
    name: item.name,
    price: item.price,
    slug: item.slug,
    tone: itemTone(item.category),
  };
}

/**
 * The areas are shown from the lowest recommended level to the highest, and
 * the order is the server's decision.
 */
export function sortHuntAreasByRecommendedLevel(areas: HuntAreaListEntry[]): HuntAreaListEntry[] {
  return areas.toSorted(compareHuntAreasByLevel);
}

/**
 * The primary species comes first, so the card of the area can draw the
 * creature that represents it without looking for it.
 */
function compareHuntAreaSpeciesRows(first: HuntAreaSpeciesRow, second: HuntAreaSpeciesRow): number {
  if (first.is_primary !== second.is_primary) {
    return first.is_primary ? -1 : 1;
  }
  return first.position - second.position;
}

function compareHuntAreasByLevel(first: HuntAreaListEntry, second: HuntAreaListEntry): number {
  if (first.recommendedLevel !== second.recommendedLevel) {
    return first.recommendedLevel - second.recommendedLevel;
  }
  return first.slug.localeCompare(second.slug);
}

function mapEntry(row: HuntAreaSpeciesRow): HuntAreaSpeciesEntry {
  return { isPrimary: row.is_primary, species: mapHuntAreaSpecies(row) };
}

function readEntrySpecies(entry: HuntAreaSpeciesEntry): HuntAreaSpecies {
  return entry.species;
}

function readPrimaryEntry(entry: HuntAreaSpeciesEntry): boolean {
  return entry.isPrimary;
}
