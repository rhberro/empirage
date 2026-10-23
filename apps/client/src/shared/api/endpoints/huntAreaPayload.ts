import type {
  HuntArea,
  HuntAreaDetail,
  HuntAreaItem,
  HuntAreaSpecies,
  HuntAreaTone,
} from '@creatures/contracts/hunt';
import type { ItemCategory } from '@creatures/contracts/inventory';
import type { Element } from '@creatures/contracts/species';

const TONES: readonly HuntAreaTone[] = [
  'arcane',
  'blood',
  'ember',
  'frost',
  'gold',
  'neutral',
  'verdant',
];

const ELEMENTS: readonly Element[] = ['fire', 'neutral', 'plant', 'water'];

const ITEM_CATEGORIES: readonly ItemCategory[] = ['consumable', 'device', 'material'];

/**
 * A leitura do corpo de uma area de caca.
 *
 * O corpo vem do servidor, e o cliente so aceita o que ele reconhece: uma
 * especie sem elemento ou um item sem categoria sao descartados, porque o
 * resto da interface nao sabe desenha-los.
 */
export function readHuntAreas(body: unknown): HuntArea[] {
  if (typeof body !== 'object' || body === null) {
    return [];
  }
  const areas = (body as { areas?: unknown }).areas;
  if (!Array.isArray(areas)) {
    return [];
  }
  const parsed = areas.map(readHuntArea);
  return parsed.filter(isPresent);
}

export function readHuntAreaDetail(body: unknown): HuntAreaDetail | null {
  const entry = readRecord(body);
  if (entry === null) {
    return null;
  }
  const area = readHuntArea(entry);
  if (area === null) {
    return null;
  }
  return { ...area, items: readHuntAreaItems(entry.items) };
}

function readHuntArea(value: unknown): HuntArea | null {
  const entry = readRecord(value);
  if (entry === null) {
    return null;
  }
  const id = readString(entry.id);
  const name = readString(entry.name);
  const slug = readString(entry.slug);
  const description = readString(entry.description);
  const minimumLevel = readNumber(entry.minimumLevel);
  const recommendedLevel = readNumber(entry.recommendedLevel);
  const primarySpecies = readHuntAreaSpecies(entry.primarySpecies);
  if (id === null || name === null || slug === null || description === null) {
    return null;
  }
  if (minimumLevel === null || recommendedLevel === null) {
    return null;
  }
  if (primarySpecies === null) {
    return null;
  }
  return {
    description,
    id,
    minimumLevel,
    name,
    primarySpecies,
    recommendedLevel,
    slug,
    species: readHuntAreaSpeciesList(entry.species),
    tone: readTone(entry.tone),
  };
}

function readHuntAreaSpeciesList(value: unknown): HuntAreaSpecies[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsed = value.map(readHuntAreaSpecies);
  return parsed.filter(isPresent);
}

function readHuntAreaSpecies(value: unknown): HuntAreaSpecies | null {
  const entry = readRecord(value);
  if (entry === null) {
    return null;
  }
  const species = readSpeciesSummary(entry.species);
  if (species === null) {
    return null;
  }
  return { species, tone: readTone(entry.tone) };
}

function readSpeciesSummary(value: unknown): HuntAreaSpecies['species'] | null {
  const entry = readRecord(value);
  if (entry === null) {
    return null;
  }
  const id = readString(entry.id);
  const name = readString(entry.name);
  const slug = readString(entry.slug);
  const element = entry.element;
  if (id === null || name === null || slug === null) {
    return null;
  }
  if (!ELEMENTS.includes(element as Element)) {
    return null;
  }
  return { element: element as Element, id, name, slug };
}

function readHuntAreaItems(value: unknown): HuntAreaItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsed = value.map(readHuntAreaItem);
  return parsed.filter(isPresent);
}

function readHuntAreaItem(value: unknown): HuntAreaItem | null {
  const entry = readRecord(value);
  if (entry === null) {
    return null;
  }
  const itemId = readString(entry.itemId);
  const name = readString(entry.name);
  const slug = readString(entry.slug);
  const category = entry.category;
  if (itemId === null || name === null || slug === null) {
    return null;
  }
  if (!ITEM_CATEGORIES.includes(category as ItemCategory)) {
    return null;
  }
  return {
    category: category as ItemCategory,
    description: readString(entry.description) ?? '',
    isStoreItem: entry.isStoreItem === true,
    itemId,
    name,
    price: readNumber(entry.price) ?? 0,
    slug,
    tone: readTone(entry.tone),
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * A tone the client does not know is drawn as neutral, the same way the server
 * falls back when the column of the area carries a tone that is not in the
 * contract.
 */
function readTone(value: unknown): HuntAreaTone {
  return TONES.includes(value as HuntAreaTone) ? (value as HuntAreaTone) : 'neutral';
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
