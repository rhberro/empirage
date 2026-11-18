import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type {
  CharacterProfile,
  CollectionCreatureProgress,
  CollectionPatchEvent,
  CollectionStateEvent,
  GameEvent,
} from '../api/game-protocol';
import { applyHuntDelta } from '../api/hunt-protocol';
import type {
  BattleConfiguration,
  HuntAbility,
  HuntAvailableAbility,
  HuntState,
} from '../api/hunt-protocol';
import { normalizeCollection } from './collection-normalization.ts';
import type { CreatureEntities, NormalizedCollection } from './collection-normalization.ts';
import { collectionWithStructure } from './collection-structure.ts';

type Collection = CollectionStateEvent['collection'] | null;
type PartyCreature = CollectionStateEvent['collection']['party'][number];
type CreatureProgressEntry = [string, CollectionCreatureProgress];
type BattleConfigurationKey = keyof BattleConfiguration;
type HuntAbilities = Array<HuntAbility>;
type HuntAvailableAbilities = Array<HuntAvailableAbility>;
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

const EMPTY_ABILITIES: HuntAbilities = [];
const EMPTY_AVAILABLE_ABILITIES: HuntAvailableAbilities = [];
const EMPTY_CAPTURE_ITEMS: BattleConfiguration['captureItems'] = [];
const EMPTY_HEALING_ITEMS: BattleConfiguration['healingItems'] = [];

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
    creaturesById: {},
    hunt: null,
    huntSyncRequired: false,
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
    const state = { hunt: event.hunt, huntSyncRequired: false };
    gameStore.setState(state);
    return;
  }
  if (event.type === 'hunt_delta') {
    const current = gameStore.getState().hunt;
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
    const hunt = applyHuntDelta(current, event.patch, event.revision);
    setHunt(hunt);
    return;
  }
  if (event.type === 'hunt_combat_event') {
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
  const current = gameStore.getState();
  const collection = selectCollection(current);
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
  const current = gameStore.getState();
  const normalized = normalizeCollection(collection, current.creaturesById, current.collection);
  const state = {
    collection: normalized.collection,
    collectionSyncRequired: false,
    creaturesById: normalized.creaturesById,
  };
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
  const collection = state.collection;
  if (!collection) {
    return null;
  }
  const { partyIds: _partyIds, storageIds: _storageIds, ...snapshot } = collection;
  return snapshot;
}

export function selectHunt(state: GameStoreState): HuntState | null {
  return state.hunt;
}

export function selectProfile(state: GameStoreState): CharacterProfile | null {
  return state.profile;
}

export function selectIsHunting(state: GameStoreState): boolean {
  return state.hunt !== null;
}

export function selectHuntActiveCreatureAbilities(state: GameStoreState): HuntAbilities {
  return battleConfigurationValue(state, 'activeCreatureAbilities', EMPTY_ABILITIES);
}

export function selectHuntActiveCreatureAbilityBySlot(
  slot: number,
  state: GameStoreState,
): HuntAbility | undefined {
  const abilities = battleConfigurationValue(state, 'activeCreatureAbilities', EMPTY_ABILITIES);
  for (const ability of abilities) {
    if (ability.slot === slot) {
      return ability;
    }
  }
  return undefined;
}

export function selectHuntAvailableAbilities(state: GameStoreState): HuntAvailableAbilities {
  return battleConfigurationValue(
    state,
    'activeCreatureAvailableAbilities',
    EMPTY_AVAILABLE_ABILITIES,
  );
}

export function selectHuntActiveCreatureLevel(state: GameStoreState): number | undefined {
  return battleConfigurationValue(state, 'activeCreatureLevel');
}

export function selectCaptureConfiguration(
  state: GameStoreState,
): BattleConfiguration['captureConfiguration'] {
  return battleConfigurationValue(state, 'captureConfiguration');
}

export function selectCaptureItems(state: GameStoreState): BattleConfiguration['captureItems'] {
  return battleConfigurationValue(state, 'captureItems', EMPTY_CAPTURE_ITEMS);
}

export function selectHealingConfiguration(
  state: GameStoreState,
): BattleConfiguration['healingConfiguration'] {
  return battleConfigurationValue(state, 'healingConfiguration');
}

export function selectHealingItemCooldownEndsAt(state: GameStoreState): number | undefined {
  return battleConfigurationValue(state, 'healingItemCooldownEndsAt');
}

export function selectHealingItems(state: GameStoreState): BattleConfiguration['healingItems'] {
  return battleConfigurationValue(state, 'healingItems', EMPTY_HEALING_ITEMS);
}

export * from './game-selectors';

function battleConfiguration(state: GameStoreState): BattleConfiguration | undefined {
  if (state.hunt) {
    return state.hunt;
  }
  return state.collection ? state.collection.configuration : undefined;
}

function battleConfigurationValue<Key extends BattleConfigurationKey>(
  state: GameStoreState,
  key: Key,
  fallback: BattleConfiguration[Key],
): BattleConfiguration[Key] {
  const configuration = battleConfiguration(state);
  return configuration ? configuration[key] : fallback;
}
