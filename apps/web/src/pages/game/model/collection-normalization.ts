import type { CollectionCreature, CollectionStateEvent } from '../api/game-protocol';

type Collection = CollectionStateEvent['collection'] | null;
type CollectionMetadata = Omit<NonNullable<Collection>, 'party' | 'storage'>;
type CreatureIds = Array<string>;
type Creatures = Array<CollectionCreature>;
type ElementComparator = (element: string, index: number) => boolean;
export type CreatureEntities = Record<string, CollectionCreature>;
export type NormalizedCollection = CollectionMetadata & {
  party: Creatures;
  partyIds: CreatureIds;
  storage: Creatures;
  storageIds: CreatureIds;
};
type NormalizedCollectionResult = {
  collection: NormalizedCollection | null;
  creaturesById: CreatureEntities;
};

export function normalizeCollection(
  collection: Collection,
  currentEntities: CreatureEntities,
  currentCollection: NormalizedCollection | null,
): NormalizedCollectionResult {
  if (!collection) {
    return { collection: null, creaturesById: {} };
  }
  const creaturesById: CreatureEntities = {};
  const nextParty = normalizeCreatures(collection.party, currentEntities, creaturesById);
  const nextStorage = normalizeCreatures(collection.storage, currentEntities, creaturesById);
  const currentParty = currentCollection ? currentCollection.party : undefined;
  const currentStorage = currentCollection ? currentCollection.storage : undefined;
  const currentPartyIds = currentCollection ? currentCollection.partyIds : undefined;
  const currentStorageIds = currentCollection ? currentCollection.storageIds : undefined;
  const party = stableCreatures(currentParty, nextParty);
  const storage = stableCreatures(currentStorage, nextStorage);
  const nextPartyIds = party.map(creatureId);
  const nextStorageIds = storage.map(creatureId);
  const partyIds = stableIds(currentPartyIds, nextPartyIds);
  const storageIds = stableIds(currentStorageIds, nextStorageIds);
  const normalized = { ...collection, party, partyIds, storage, storageIds };
  return { collection: normalized, creaturesById };
}

function stableCreatures(current: Creatures | undefined, next: Creatures): Creatures {
  return current && sameReferences(current, next) ? current : next;
}

function stableIds(current: CreatureIds | undefined, next: CreatureIds): CreatureIds {
  return current && sameValues(current, next) ? current : next;
}

function sameReferences(first: Creatures, second: Creatures): boolean {
  if (first.length !== second.length) {
    return false;
  }
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }
  return true;
}

function sameValues(first: CreatureIds, second: CreatureIds): boolean {
  if (first.length !== second.length) {
    return false;
  }
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }
  return true;
}

function normalizeCreatures(
  creatures: Creatures,
  currentEntities: CreatureEntities,
  nextEntities: CreatureEntities,
): Creatures {
  function normalizeCreature(creature: CollectionCreature): CollectionCreature {
    const current = currentEntities[creature.id];
    const normalized = current && sameCreature(current, creature) ? current : creature;
    nextEntities[creature.id] = normalized;
    return normalized;
  }
  return creatures.map(normalizeCreature);
}

function creatureId(creature: CollectionCreature): string {
  return creature.id;
}

function sameCreature(first: CollectionCreature, second: CollectionCreature): boolean {
  return (
    first.id === second.id &&
    first.capturedAt === second.capturedAt &&
    first.experience === second.experience &&
    first.experienceLevelStart === second.experienceLevelStart &&
    first.experienceNextLevel === second.experienceNextLevel &&
    first.gender === second.gender &&
    first.ivAttack === second.ivAttack &&
    first.ivDefense === second.ivDefense &&
    first.ivHealth === second.ivHealth &&
    first.ivSpecialAttack === second.ivSpecialAttack &&
    first.ivSpecialDefense === second.ivSpecialDefense &&
    first.ivSpeed === second.ivSpeed &&
    first.level === second.level &&
    first.partySlot === second.partySlot &&
    first.rarity === second.rarity &&
    sameElements(first.elements, second.elements) &&
    sameSpecies(first.species, second.species)
  );
}

function sameElements(first: Array<string>, second: Array<string>): boolean {
  return first.length === second.length && first.every(sameElement(second));
}

function sameElement(second: Array<string>): ElementComparator {
  return function equalsElement(element: string, index: number): boolean {
    return element === second[index];
  };
}

function sameSpecies(
  first: CollectionCreature['species'],
  second: CollectionCreature['species'],
): boolean {
  return (
    first.base_attack === second.base_attack &&
    first.base_defense === second.base_defense &&
    first.base_hp === second.base_hp &&
    first.base_special_attack === second.base_special_attack &&
    first.base_special_defense === second.base_special_defense &&
    first.base_speed === second.base_speed &&
    first.description === second.description &&
    first.id === second.id &&
    first.name === second.name
  );
}
