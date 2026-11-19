/* eslint-disable complexity, max-lines, max-lines-per-function, oxsome/no-inline-functions-objects-arrays */
import type { SupabaseClient } from '@supabase/supabase-js';

import { experienceForLevel } from './hunt-engine.ts';
type CreatureRow = {
  captured_at: string;
  experience: number | string;
  gender: string;
  id: string;
  iv_attack: number;
  iv_defense: number;
  iv_hp: number;
  iv_special_attack: number;
  iv_special_defense: number;
  iv_speed: number;
  level: number;
  party_slot: number | null;
  rarity: string;
  species_id: number;
};
type CreatureRows = Array<CreatureRow>;
type SpeciesRow = {
  base_attack: number;
  base_defense: number;
  base_hp: number;
  base_special_attack: number;
  base_special_defense: number;
  base_speed: number;
  description: string;
  id: number;
  name: string;
};
type SpeciesRows = Array<SpeciesRow>;
type SpeciesTypeRow = { species_id: number; type_id: number };
type SpeciesTypeRows = Array<SpeciesTypeRow>;
type TypeRow = { id: number; name: string };
type TypeRows = Array<TypeRow>;
type ActiveCreatureRow = { active_creature_id: string | null; collection_revision: number };
type CreatureCollectionItem = {
  capturedAt: string;
  elements: Array<string>;
  experience: string;
  experienceLevelStart: string;
  experienceNextLevel: string;
  gender: string;
  id: string;
  ivAttack: number;
  ivDefense: number;
  ivHealth: number;
  ivSpecialAttack: number;
  ivSpecialDefense: number;
  ivSpeed: number;
  level: number;
  partySlot: number | null;
  rarity: string;
  species: SpeciesRow;
};
type CreatureCollectionItems = Array<CreatureCollectionItem>;
type CreatureProgressRow = {
  experience: number | string;
  id: string;
  level: number;
  species_id: number;
};
type CreatureProgressRows = Array<CreatureProgressRow>;

export type CreatureCollectionProgress = {
  experience: string;
  experienceLevelStart: string;
  experienceNextLevel: string;
  id: string;
  level: number;
  speciesId: number;
};
export type CreatureCollectionProgresses = Array<CreatureCollectionProgress>;

export type CreatureCollection = {
  activeCreatureId: string | null;
  revision: number;
  configuration?: unknown;
  party: CreatureCollectionItems;
  storage: CreatureCollectionItems;
  storagePage: number;
  storagePageCount: number;
  storageTotal: number;
};
type CollectionStructureCreatureRow = { id: string; party_slot: number | null };
type CollectionStructureCreatureRows = Array<CollectionStructureCreatureRow>;
export type CreatureCollectionStructure = {
  activeCreatureId: string | null;
  partyIds: Array<string>;
  revision: number;
  storageIds: Array<string>;
  storagePage: number;
  storagePageCount: number;
  storageTotal: number;
};

const STORAGE_PAGE_SIZE = 50;

function structureCreatureId(row: CollectionStructureCreatureRow): string {
  return row.id;
}

function numberIds(rows: CreatureRows): Array<number> {
  const ids = new Set<number>();
  for (const row of rows) {
    ids.add(row.species_id);
  }
  return [...ids];
}

function collectionItem(
  row: CreatureRow,
  species: SpeciesRow,
  elementsBySpecies: Map<number, Array<string>>,
): CreatureCollectionItem {
  const experienceLevelStart = experienceForLevel(row.level).toString();
  const experienceNextLevel = experienceForLevel(row.level + 1).toString();
  return {
    capturedAt: row.captured_at,
    elements: elementsBySpecies.get(row.species_id) ?? [],
    experience: String(row.experience),
    experienceLevelStart,
    experienceNextLevel,
    gender: row.gender,
    id: row.id,
    ivAttack: row.iv_attack,
    ivDefense: row.iv_defense,
    ivHealth: row.iv_hp,
    ivSpecialAttack: row.iv_special_attack,
    ivSpecialDefense: row.iv_special_defense,
    ivSpeed: row.iv_speed,
    level: row.level,
    partySlot: row.party_slot,
    rarity: row.rarity,
    species,
  };
}

function compareParty(first: CreatureCollectionItem, second: CreatureCollectionItem): number {
  return (first.partySlot ?? 0) - (second.partySlot ?? 0);
}

export async function loadCreatureCollectionProgress(
  client: SupabaseClient,
  characterId: string,
): Promise<CreatureCollectionProgresses> {
  const fields = 'id, species_id, experience, level';
  const result = await client
    .from('creatures')
    .select(fields)
    .eq('character_id', characterId)
    .not('party_slot', 'is', null)
    .order('party_slot', { ascending: true });
  if (result.error) {
    throw result.error;
  }
  const rows = (result.data ?? []) as CreatureProgressRows;
  return rows.map(function toProgress(row): CreatureCollectionProgress {
    return {
      experience: String(row.experience),
      experienceLevelStart: experienceForLevel(row.level).toString(),
      experienceNextLevel: experienceForLevel(row.level + 1).toString(),
      id: row.id,
      level: row.level,
      speciesId: row.species_id,
    };
  });
}

const cachedSpeciesById = new Map<number, SpeciesRow>();
const cachedElementsBySpecies = new Map<number, Array<string>>();

function isSpeciesMissing(id: number): boolean {
  return !cachedSpeciesById.has(id);
}

async function ensureSpeciesMetadata(
  client: SupabaseClient,
  speciesIds: Array<number>,
): Promise<void> {
  const missingSpeciesIds = speciesIds.filter(isSpeciesMissing);
  if (missingSpeciesIds.length === 0) {
    return;
  }
  const [speciesResult, speciesTypesResult] = await Promise.all([
    client
      .from('species')
      .select(
        'id, name, description, base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed',
      )
      .in('id', missingSpeciesIds),
    client.from('species_types').select('species_id, type_id').in('species_id', missingSpeciesIds),
  ]);
  if (speciesResult.error) {
    throw speciesResult.error;
  }
  if (speciesTypesResult.error) {
    throw speciesTypesResult.error;
  }
  const speciesRows = speciesResult.data as SpeciesRows;
  const speciesTypeRows = speciesTypesResult.data as SpeciesTypeRows;
  const typeIds = [...new Set(speciesTypeRows.map(typeIdForSpecies))];
  const typesResult =
    typeIds.length > 0
      ? await client.from('types').select('id, name').in('id', typeIds)
      : { data: [], error: null };
  if (typesResult.error) {
    throw typesResult.error;
  }
  const types = typesResult.data as TypeRows;
  const typeNames = new Map<number, string>();
  for (const type of types) {
    typeNames.set(type.id, type.name);
  }
  for (const relation of speciesTypeRows) {
    const elements = cachedElementsBySpecies.get(relation.species_id) ?? [];
    const name = typeNames.get(relation.type_id);
    if (name) {
      elements.push(name);
    }
    cachedElementsBySpecies.set(relation.species_id, elements);
  }
  for (const species of speciesRows) {
    cachedSpeciesById.set(species.id, species);
  }
}

export async function loadCreatureCollection(
  client: SupabaseClient,
  characterId: string,
  requestedStoragePage = 1,
): Promise<CreatureCollection> {
  const requestedPage = Math.max(1, Math.trunc(requestedStoragePage));
  const storageStart = (requestedPage - 1) * STORAGE_PAGE_SIZE;
  const storageEnd = storageStart + STORAGE_PAGE_SIZE - 1;
  const fields =
    'id, species_id, party_slot, gender, experience, level, rarity, captured_at, iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed';
  const [activeCreatureResult, partyResult, storageResult] = await Promise.all([
    client
      .from('characters')
      .select('active_creature_id, collection_revision')
      .eq('id', characterId)
      .single(),
    client
      .from('creatures')
      .select(fields)
      .eq('character_id', characterId)
      .not('party_slot', 'is', null)
      .order('party_slot', { ascending: true }),
    client
      .from('creatures')
      .select(fields, { count: 'exact' })
      .eq('character_id', characterId)
      .is('party_slot', null)
      .order('captured_at', { ascending: false })
      .range(storageStart, storageEnd),
  ]);
  if (activeCreatureResult.error) {
    throw activeCreatureResult.error;
  }
  if (partyResult.error) {
    throw partyResult.error;
  }
  if (storageResult.error) {
    throw storageResult.error;
  }
  const storageTotal = storageResult.count ?? 0;
  const storagePageCount = Math.max(1, Math.ceil(storageTotal / STORAGE_PAGE_SIZE));
  const storagePage = Math.min(requestedPage, storagePageCount);
  let storageRows = storageResult.data as CreatureRows;
  if (storagePage !== requestedPage) {
    const pageStart = (storagePage - 1) * STORAGE_PAGE_SIZE;
    const pageEnd = pageStart + STORAGE_PAGE_SIZE - 1;
    const storagePageResult = await client
      .from('creatures')
      .select(fields)
      .eq('character_id', characterId)
      .is('party_slot', null)
      .order('captured_at', { ascending: false })
      .range(pageStart, pageEnd);
    if (storagePageResult.error) {
      throw storagePageResult.error;
    }
    storageRows = storagePageResult.data as CreatureRows;
  }
  const creatureRows = [...(partyResult.data as CreatureRows), ...storageRows];
  const speciesIds = numberIds(creatureRows);
  if (speciesIds.length === 0) {
    return {
      activeCreatureId: null,
      party: [],
      revision: activeCreatureResult.data.collection_revision,
      storage: [],
      storagePage: 1,
      storagePageCount,
      storageTotal,
    };
  }
  await ensureSpeciesMetadata(client, speciesIds);
  const party: CreatureCollectionItems = [];
  const storage: CreatureCollectionItems = [];
  for (const row of creatureRows) {
    const species = cachedSpeciesById.get(row.species_id);
    if (!species) {
      continue;
    }
    const item = collectionItem(row, species, cachedElementsBySpecies);
    if (item.partySlot === null) {
      storage.push(item);
    } else {
      party.push(item);
    }
  }
  party.sort(compareParty);
  const activeCreature = activeCreatureResult.data as ActiveCreatureRow;
  return {
    activeCreatureId: activeCreature.active_creature_id,
    party,
    revision: activeCreature.collection_revision,
    storage,
    storagePage,
    storagePageCount,
    storageTotal,
  };
}

export async function loadCreatureCollectionStructure(
  client: SupabaseClient,
  characterId: string,
  requestedStoragePage: number,
): Promise<CreatureCollectionStructure> {
  const requestedPage = Math.max(1, Math.trunc(requestedStoragePage));
  const storageStart = (requestedPage - 1) * STORAGE_PAGE_SIZE;
  const storageEnd = storageStart + STORAGE_PAGE_SIZE - 1;
  const [activeCreatureResult, partyResult, storageResult] = await Promise.all([
    client
      .from('characters')
      .select('active_creature_id, collection_revision')
      .eq('id', characterId)
      .single(),
    client
      .from('creatures')
      .select('id, party_slot')
      .eq('character_id', characterId)
      .not('party_slot', 'is', null)
      .order('party_slot', { ascending: true }),
    client
      .from('creatures')
      .select('id', { count: 'exact' })
      .eq('character_id', characterId)
      .is('party_slot', null)
      .order('captured_at', { ascending: false })
      .range(storageStart, storageEnd),
  ]);
  if (activeCreatureResult.error) {
    throw activeCreatureResult.error;
  }
  if (partyResult.error) {
    throw partyResult.error;
  }
  if (storageResult.error) {
    throw storageResult.error;
  }
  const storageTotal = storageResult.count ?? 0;
  const storagePageCount = Math.max(1, Math.ceil(storageTotal / STORAGE_PAGE_SIZE));
  const storagePage = Math.min(requestedPage, storagePageCount);
  let storageRows = storageResult.data as CollectionStructureCreatureRows;
  if (storagePage !== requestedPage) {
    const pageStart = (storagePage - 1) * STORAGE_PAGE_SIZE;
    const pageEnd = pageStart + STORAGE_PAGE_SIZE - 1;
    const storagePageResult = await client
      .from('creatures')
      .select('id')
      .eq('character_id', characterId)
      .is('party_slot', null)
      .order('captured_at', { ascending: false })
      .range(pageStart, pageEnd);
    if (storagePageResult.error) {
      throw storagePageResult.error;
    }
    storageRows = storagePageResult.data as CollectionStructureCreatureRows;
  }
  const activeCreature = activeCreatureResult.data as ActiveCreatureRow;
  const party = partyResult.data as CollectionStructureCreatureRows;
  return {
    activeCreatureId: activeCreature.active_creature_id,
    partyIds: party.map(structureCreatureId),
    revision: activeCreature.collection_revision,
    storageIds: storageRows.map(structureCreatureId),
    storagePage,
    storagePageCount,
    storageTotal,
  };
}

function typeIdForSpecies(relation: SpeciesTypeRow): number {
  return relation.type_id;
}
