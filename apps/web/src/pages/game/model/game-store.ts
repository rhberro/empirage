import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
  CharacterProfile,
  CollectionCreatureProgress,
  CollectionPatchEvent,
  CollectionStateEvent,
  GameEvent,
} from '../api/game-protocol';
import type { HuntState } from '../api/hunt-protocol';

type Collection = CollectionStateEvent['collection'] | null;
type PartyCreature = CollectionStateEvent['collection']['party'][number];
type CreatureProgressEntry = [string, CollectionCreatureProgress];
type GameStoreState = {
  collection: Collection;
  collectionSyncRequired: boolean;
  hunt: HuntState | null;
  profile: CharacterProfile | null;
  applyCollectionPatch: (event: CollectionPatchEvent) => boolean;
  applyGameEvent: (event: GameEvent) => void;
  setCollection: (collection: Collection) => void;
  setHunt: (hunt: HuntState | null) => void;
  setProfile: (profile: CharacterProfile | null) => void;
};
type GameStoreSelector<T> = (state: GameStoreState) => T;

function progressEntry(entry: CollectionCreatureProgress): CreatureProgressEntry {
  return [entry.id, entry];
}

function missingCreature(creature: PartyCreature | null): boolean {
  return creature === null;
}

function createInitialState(): GameStoreState {
  return {
    applyCollectionPatch,
    applyGameEvent,
    collection: null,
    collectionSyncRequired: false,
    hunt: null,
    profile: null,
    setCollection,
    setHunt,
    setProfile,
  };
}

function applyGameEvent(event: GameEvent): void {
  if (event.type === 'authenticated') {
    setProfile(event.profile);
    return;
  }
  if (event.type === 'hunt_state') {
    setHunt(event.hunt);
    return;
  }
  if (event.type === 'collection_state') {
    setCollection(event.collection);
    return;
  }
  if (event.type === 'collection_patch') {
    const applied = applyCollectionPatch(event);
    const state = { collectionSyncRequired: !applied };
    gameStore.setState(state);
  }
}

function applyCollectionPatch(event: CollectionPatchEvent): boolean {
  const collection = gameStore.getState().collection;
  if (!collection || event.revision !== collection.revision + 1 || !collection.configuration) {
    return false;
  }
  const party = applyCreatureProgress(collection.party, event.creatures);
  const storage = applyCreatureProgress(collection.storage, event.creatures);
  if (!party || !storage) {
    return false;
  }
  const configuration = {
    ...collection.configuration,
    ...event.configuration,
    captureConfiguration:
      event.configuration.captureConfiguration === null
        ? undefined
        : (event.configuration.captureConfiguration ??
          collection.configuration.captureConfiguration),
    healingConfiguration:
      event.configuration.healingConfiguration === null
        ? undefined
        : (event.configuration.healingConfiguration ??
          collection.configuration.healingConfiguration),
  };
  const next = { ...collection, configuration, party, revision: event.revision, storage };
  setCollection(next);
  return true;
}

function applyCreatureProgress(
  creatures: CollectionStateEvent['collection']['party'],
  progress: CollectionPatchEvent['creatures'],
): CollectionStateEvent['collection']['party'] | null {
  if (!progress) {
    return creatures;
  }
  const progressEntries = progress.map(progressEntry);
  const progressById = new Map(progressEntries);
  function updateCreature(creature: PartyCreature): PartyCreature | null {
    const update = progressById.get(creature.id);
    if (!update) {
      return creature;
    }
    if (update.speciesId !== creature.species.id) {
      return null;
    }
    return {
      ...creature,
      experience: update.experience,
      experienceLevelStart: update.experienceLevelStart,
      experienceNextLevel: update.experienceNextLevel,
      level: update.level,
    };
  }
  const next = creatures.map(updateCreature);
  return next.some(missingCreature) ? null : (next as CollectionStateEvent['collection']['party']);
}

function setCollection(collection: Collection): void {
  const state = { collection, collectionSyncRequired: false };
  gameStore.setState(state);
}

function setHunt(hunt: HuntState | null): void {
  const state = { hunt };
  gameStore.setState(state);
}

function setProfile(profile: CharacterProfile | null): void {
  const state = { profile };
  gameStore.setState(state);
}

export const gameStore = createStore<GameStoreState>()(createInitialState);

export function useGameStore<T>(selector: GameStoreSelector<T>): T {
  return useStore(gameStore, selector);
}

export function selectCollection(state: GameStoreState): Collection {
  return state.collection;
}

export function selectHunt(state: GameStoreState): HuntState | null {
  return state.hunt;
}

export function selectProfile(state: GameStoreState): CharacterProfile | null {
  return state.profile;
}
