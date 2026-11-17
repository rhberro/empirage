import type { CollectionCreature, CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand } from '../api/hunt-protocol';
import type { BattleConfiguration } from '../api/hunt-protocol';

type Collection = CollectionStateEvent['collection'];
type Creatures = Array<CollectionCreature>;
type CreaturePredicate = (creature: CollectionCreature) => boolean;

const STORAGE_PAGE_SIZE = 50;

function matchingCreature(creatureId: string): CreaturePredicate {
  return function matches(creature: CollectionCreature): boolean {
    return creature.id === creatureId;
  };
}

function otherCreature(creatureId: string): CreaturePredicate {
  return function isOther(creature: CollectionCreature): boolean {
    return creature.id !== creatureId;
  };
}

function firstAvailableSlot(party: Creatures): number {
  for (let slot = 1; slot <= 6; slot += 1) {
    let occupied = false;
    for (const creature of party) {
      if (creature.partySlot === slot) {
        occupied = true;
        break;
      }
    }
    if (!occupied) {
      return slot;
    }
  }
  return 0;
}

function comparePartySlot(first: CollectionCreature, second: CollectionCreature): number {
  return (first.partySlot ?? 0) - (second.partySlot ?? 0);
}

function compareCaptureDate(first: CollectionCreature, second: CollectionCreature): number {
  return second.capturedAt.localeCompare(first.capturedAt);
}

function selectedConfiguration(
  collection: Collection,
  creatureId: string,
): BattleConfiguration | undefined {
  const preview = collection.partyConfigurations
    ? collection.partyConfigurations[creatureId]
    : undefined;
  return preview && collection.configuration
    ? { ...collection.configuration, ...preview }
    : undefined;
}

function switchSelected(collection: Collection, creatureId: string): Collection {
  const matches = matchingCreature(creatureId);
  if (collection.activeCreatureId === creatureId || !collection.party.some(matches)) {
    return collection;
  }
  return {
    ...collection,
    activeCreatureId: creatureId,
    configuration: selectedConfiguration(collection, creatureId),
  };
}

function addToParty(collection: Collection, creatureId: string): Collection {
  const matches = matchingCreature(creatureId);
  const isOther = otherCreature(creatureId);
  const creature = collection.storage.find(matches);
  const slot = firstAvailableSlot(collection.party);
  if (!creature || slot === 0) {
    return collection;
  }
  const party = [...collection.party, { ...creature, partySlot: slot }].toSorted(comparePartySlot);
  const storageTotal = Math.max(0, collection.storageTotal - 1);
  return {
    ...collection,
    party,
    storage: collection.storage.filter(isOther),
    storagePageCount: Math.max(1, Math.ceil(storageTotal / STORAGE_PAGE_SIZE)),
    storageTotal,
  };
}

function moveToStorage(collection: Collection, creatureId: string): Collection {
  const matches = matchingCreature(creatureId);
  const isOther = otherCreature(creatureId);
  const creature = collection.party.find(matches);
  if (!creature || collection.party.length <= 1) {
    return collection;
  }
  const party = collection.party.filter(isOther);
  const storageTotal = collection.storageTotal + 1;
  const storage =
    collection.storagePage === 1
      ? [...collection.storage, { ...creature, partySlot: null }]
          .toSorted(compareCaptureDate)
          .slice(0, STORAGE_PAGE_SIZE)
      : collection.storage;
  const firstPartyCreature = party[0];
  const activeCreatureId =
    collection.activeCreatureId === creatureId
      ? firstPartyCreature
        ? firstPartyCreature.id
        : null
      : collection.activeCreatureId;
  return {
    ...collection,
    activeCreatureId,
    configuration:
      activeCreatureId === collection.activeCreatureId
        ? collection.configuration
        : activeCreatureId
          ? selectedConfiguration(collection, activeCreatureId)
          : undefined,
    party,
    storage,
    storagePageCount: Math.max(1, Math.ceil(storageTotal / STORAGE_PAGE_SIZE)),
    storageTotal,
  };
}

export function optimisticPartyState(collection: Collection, command: HuntCommand): Collection {
  if (command.type === 'switch_active_creature') {
    return switchSelected(collection, command.creatureId);
  }
  if (command.type === 'move_creature_to_party') {
    return addToParty(collection, command.creatureId);
  }
  if (command.type === 'move_creature_to_storage') {
    return moveToStorage(collection, command.creatureId);
  }
  return collection;
}
