import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
  CharacterProfile,
  CollectionCreature,
  CollectionPatchEvent,
  CollectionStateEvent,
  GameEvent,
} from '../api/game-protocol';
import { applyHuntDelta } from '../api/hunt-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import {
  applyCreatureProgress,
  normalizeCollection,
  syncCreatureHuntProgress,
  updateCreatureInList,
} from './collection-normalization.ts';
import type { CreatureEntities, NormalizedCollection } from './collection-normalization.ts';
import { collectionWithStructure } from './collection-structure.ts';
import { PaginatedEntityCache } from './paginated-cache.ts';
import { PendingCommandQueue } from './pending-commands.ts';

type Collection = CollectionStateEvent['collection'] | null;
type HuntEvent = Extract<GameEvent, { type: 'hunt_state' | 'hunt_delta' }>;
type CollectionEvent = Extract<GameEvent, { type: 'collection_state' | 'collection_patch' }>;
export type GameStoreState = {
  collection: NormalizedCollection | null;
  collectionSyncRequired: boolean;
  creaturesById: CreatureEntities;
  hunt: HuntState | null;
  huntSyncRequired: boolean;
  profile: CharacterProfile | null;
  applyCollectionPatch: (event: CollectionPatchEvent) => boolean;
  applyGameEvent: (event: GameEvent) => void;
  setCollection: (collection: Collection) => void;
  setHunt: (hunt: HuntState | null) => void;
  setProfile: (profile: CharacterProfile | null) => void;
};
type GameStoreSelector<T> = (state: GameStoreState) => T;

function createInitialState(): GameStoreState {
  return {
    applyCollectionPatch,
    applyGameEvent,
    collection: null,
    collectionSyncRequired: false,
    creaturesById: {},
    hunt: null,
    huntSyncRequired: false,
    profile: null,
    setCollection,
    setHunt,
    setProfile,
  };
}

const pendingCommands = new PendingCommandQueue();
const storagePageCache = new PaginatedEntityCache();
let authoritativeCollection: Collection = null;
let authoritativeHunt: HuntState | null = null;

export function dispatchOptimisticCommand(command: HuntCommand): void {
  pendingCommands.evictExpired();
  pendingCommands.add(command);
  applyOptimisticProjections();
}

export function clearPendingCommands(): void {
  pendingCommands.clear();
  applyOptimisticProjections();
}

function applyOptimisticProjections(): void {
  const current = gameStore.getState();
  const projectedHunt = pendingCommands.replayOnHunt(authoritativeHunt);
  const projectedCollection = pendingCommands.replayOnCollection(authoritativeCollection);
  const normalized = normalizeCollection(
    projectedCollection,
    current.creaturesById,
    current.collection,
  );
  const state = {
    collection: normalized.collection,
    creaturesById: normalized.creaturesById,
    hunt: projectedHunt,
  };
  gameStore.setState(state);
}

function commitHuntState(projectedHunt: HuntState | null): void {
  const currentStore = gameStore.getState();
  const synced = projectedHunt
    ? syncCreatureHuntProgress(
        currentStore.creaturesById,
        currentStore.collection,
        projectedHunt.activeCreatureId,
        projectedHunt.activeCreatureLevel,
        projectedHunt.activeCreatureExperience,
        projectedHunt.activeCreatureExperienceLevelStart,
        projectedHunt.activeCreatureExperienceNextLevel,
      )
    : null;
  if (authoritativeCollection && synced && synced.updatedCreature) {
    authoritativeCollection = {
      ...authoritativeCollection,
      party: updateCreatureInList(authoritativeCollection.party, synced.updatedCreature),
    };
  }
  const collection = synced ? synced.collection : currentStore.collection;
  const creaturesById = synced ? synced.creaturesById : currentStore.creaturesById;
  const state = {
    collection,
    creaturesById,
    hunt: projectedHunt,
    huntSyncRequired: false,
  };
  gameStore.setState(state);
}

function applyHuntEvent(event: HuntEvent): void {
  pendingCommands.evictExpired();
  pendingCommands.acknowledge(event.commandId);
  if (event.type === 'hunt_state') {
    authoritativeHunt = event.hunt;
    const projectedHunt = pendingCommands.replayOnHunt(authoritativeHunt);
    commitHuntState(projectedHunt);
    return;
  }
  const current = authoritativeHunt ?? gameStore.getState().hunt;
  if (
    !event.patch ||
    !current ||
    current.huntId !== event.huntId ||
    current.revision !== event.previousRevision
  ) {
    const state = { huntSyncRequired: true };
    gameStore.setState(state);
    return;
  }
  authoritativeHunt = applyHuntDelta(current, event.patch, event.revision);
  const projectedHunt = pendingCommands.replayOnHunt(authoritativeHunt);
  commitHuntState(projectedHunt);
}

function applyCollectionEvent(event: CollectionEvent): void {
  pendingCommands.evictExpired();
  pendingCommands.acknowledge(event.commandId);
  if (event.type === 'collection_state') {
    setCollection(event.collection);
    return;
  }
  const applied = applyCollectionPatch(event);
  const state = { collectionSyncRequired: !applied };
  gameStore.setState(state);
}

function applyGameEvent(event: GameEvent): void {
  if (event.type === 'authenticated') {
    setProfile(event.profile);
    return;
  }
  if (event.type === 'hunt_state' || event.type === 'hunt_delta') {
    applyHuntEvent(event);
    return;
  }
  if (event.type === 'collection_state' || event.type === 'collection_patch') {
    applyCollectionEvent(event);
    return;
  }
  if (event.type === 'error' && event.code === 'hunt_command_failed') {
    pendingCommands.clear();
    applyOptimisticProjections();
  }
}

function applyCollectionPatch(event: CollectionPatchEvent): boolean {
  const current = gameStore.getState();
  const collection = authoritativeCollection ?? current.collection;
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
  const structure = event.structure;
  const state = {
    ...collection,
    configuration,
    party,
    revision: event.revision,
    storage,
  };
  const next = structure ? collectionWithStructure(state, configuration, structure) : state;
  if (!next) {
    return false;
  }
  if (structure) {
    storagePageCache.invalidate();
  }
  setCollection(next);
  return true;
}

function setCollection(collection: Collection): void {
  authoritativeCollection = collection;
  const current = gameStore.getState();
  const projectedCollection = pendingCommands.replayOnCollection(authoritativeCollection);
  const normalized = normalizeCollection(
    projectedCollection,
    current.creaturesById,
    current.collection,
  );
  if (normalized.collection) {
    storagePageCache.set(
      normalized.collection.storagePage,
      normalized.collection.storageIds,
      normalized.collection.revision,
    );
  }
  const state = {
    collection: normalized.collection,
    collectionSyncRequired: false,
    creaturesById: normalized.creaturesById,
  };
  gameStore.setState(state);
}

function setHunt(hunt: HuntState | null): void {
  authoritativeHunt = hunt;
  const projectedHunt = pendingCommands.replayOnHunt(authoritativeHunt);
  const state = { hunt: projectedHunt, huntSyncRequired: false };
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

export function switchToStoragePage(page: number): boolean {
  const current = gameStore.getState();
  const collection = current.collection;
  if (!collection || collection.storagePage === page) {
    return true;
  }
  const cachedIds = storagePageCache.get(page, collection.revision);
  if (!cachedIds) {
    return false;
  }
  function checkCreature(id: string): boolean {
    return Boolean(current.creaturesById[id]);
  }
  if (!cachedIds.every(checkCreature)) {
    return false;
  }
  function getCreature(id: string): CollectionCreature {
    return current.creaturesById[id];
  }
  const storage = cachedIds.map(getCreature);
  const nextCollection: NormalizedCollection = {
    ...collection,
    storage,
    storageIds: cachedIds,
    storagePage: page,
  };
  const state = { collection: nextCollection };
  gameStore.setState(state);
  return true;
}

export * from './game-selectors';
