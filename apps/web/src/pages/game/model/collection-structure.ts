import type {
  CollectionCreature,
  CollectionStateEvent,
  CollectionStructurePatch,
} from '../api/game-protocol';
import type { BattleConfiguration } from '../api/hunt-protocol';

type Collection = CollectionStateEvent['collection'];
type CreatureIndex = Map<string, CollectionCreature>;
type Creatures = Array<CollectionCreature>;

export function collectionWithStructure(
  collection: Collection,
  configuration: BattleConfiguration,
  structure: CollectionStructurePatch,
): Collection | null {
  const { activeCreatureId } = structure;
  const partyConfigurations = nextPartyConfigurations(collection, structure);
  const nextConfiguration = configurationForActiveCreature(
    configuration,
    partyConfigurations,
    activeCreatureId,
  );
  const creatures = collectionCreatureIndex(collection, structure);
  const party = creaturesForIds(structure.partyIds, creatures);
  const storage = creaturesForIds(structure.storageIds, creatures);
  if (!party || !storage) {
    return null;
  }
  return {
    ...collection,
    activeCreatureId,
    configuration: nextConfiguration,
    party,
    partyConfigurations,
    storage,
    storagePage: structure.storagePage,
    storagePageCount: structure.storagePageCount,
    storageTotal: structure.storageTotal,
  };
}

function collectionCreatureIndex(
  collection: Collection,
  structure: CollectionStructurePatch,
): CreatureIndex {
  const creatures = new Map<string, CollectionCreature>();
  const allCreatures = [...collection.party, ...collection.storage, ...structure.creatureUpserts];
  for (const creature of allCreatures) {
    creatures.set(creature.id, creature);
  }
  return creatures;
}

function creaturesForIds(ids: Array<string>, creatures: CreatureIndex): Creatures | null {
  const selected: Creatures = [];
  for (const id of ids) {
    const creature = creatures.get(id);
    if (!creature) {
      return null;
    }
    selected.push(creature);
  }
  return selected;
}

function configurationForActiveCreature(
  configuration: BattleConfiguration,
  partyConfigurations: NonNullable<CollectionStructurePatch['partyConfigurations']>,
  activeCreatureId: string | null,
): BattleConfiguration {
  if (!activeCreatureId) {
    return configuration;
  }
  const activeConfiguration = partyConfigurations[activeCreatureId];
  return activeConfiguration ? { ...configuration, ...activeConfiguration } : configuration;
}

function nextPartyConfigurations(
  collection: Collection,
  structure: CollectionStructurePatch,
): NonNullable<CollectionStructurePatch['partyConfigurations']> {
  const existing = collection.partyConfigurations ?? {};
  const updates = structure.partyConfigurations ?? {};
  const configurations = { ...existing, ...updates };
  const valid = new Set(structure.partyIds);
  const activeConfigurations: NonNullable<CollectionStructurePatch['partyConfigurations']> = {};
  for (const [creatureId, configuration] of Object.entries(configurations)) {
    if (valid.has(creatureId)) {
      activeConfigurations[creatureId] = configuration;
    }
  }
  return activeConfigurations;
}
