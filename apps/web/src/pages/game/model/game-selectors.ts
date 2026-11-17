import type { CollectionCreature, CollectionStateEvent } from '../api/game-protocol';
import type { HuntWaveRange, PartyCreatureHealth } from '../api/hunt-protocol';
import type { GameStoreState } from './game-store';

type Party = CollectionStateEvent['collection']['party'];
type Storage = CollectionStateEvent['collection']['storage'];
type CreatureIds = Array<string>;
type CreatureSelector = (state: GameStoreState) => CollectionCreature | undefined;

const EMPTY_PARTY: Party = [];
const EMPTY_STORAGE: Storage = [];
const EMPTY_CREATURE_IDS: CreatureIds = [];

export function selectPartyIds(state: GameStoreState): CreatureIds {
  return state.collection ? state.collection.partyIds : EMPTY_CREATURE_IDS;
}

export function selectStorageIds(state: GameStoreState): CreatureIds {
  return state.collection ? state.collection.storageIds : EMPTY_CREATURE_IDS;
}

export function selectParty(state: GameStoreState): Party {
  return state.collection ? state.collection.party : EMPTY_PARTY;
}

export function selectStorage(state: GameStoreState): Storage {
  return state.collection ? state.collection.storage : EMPTY_STORAGE;
}

export function selectCollectionActiveCreatureId(state: GameStoreState): string | null | undefined {
  return state.collection ? state.collection.activeCreatureId : undefined;
}

export function selectStoragePage(state: GameStoreState): number {
  return state.collection ? state.collection.storagePage : 1;
}

export function selectStoragePageCount(state: GameStoreState): number {
  return state.collection ? state.collection.storagePageCount : 1;
}

export function selectStorageTotal(state: GameStoreState): number {
  return state.collection ? state.collection.storageTotal : 0;
}

export function selectCreatureById(creatureId: string): CreatureSelector {
  return function selectCreature(state: GameStoreState): CollectionCreature | undefined {
    return state.creaturesById[creatureId];
  };
}

export function selectActiveCreatureId(state: GameStoreState): string | null | undefined {
  const collection = state.collection;
  return state.hunt
    ? state.hunt.activeCreatureId
    : collection
      ? collection.activeCreatureId
      : undefined;
}

export function selectDisplayedTrainerAvatarUrl(state: GameStoreState): string | null | undefined {
  const profile = state.profile;
  return state.hunt ? state.hunt.characterAvatarUrl : profile ? profile.avatarUrl : undefined;
}

export function selectDisplayedTrainerGold(state: GameStoreState): number {
  const profile = state.profile;
  return state.hunt ? state.hunt.gold : profile ? profile.gold : 0;
}

export function selectDisplayedTrainerLevel(state: GameStoreState): number | undefined {
  const profile = state.profile;
  return state.hunt ? state.hunt.characterLevel : profile ? profile.level : undefined;
}

export function selectDisplayedTrainerName(state: GameStoreState): string | undefined {
  const profile = state.profile;
  return state.hunt ? state.hunt.characterName : profile ? profile.name : undefined;
}

export function selectHuntId(state: GameStoreState): string | undefined {
  return state.hunt ? state.hunt.huntId : undefined;
}

export function selectHuntEnemyCount(state: GameStoreState): number {
  return state.hunt ? state.hunt.enemies.length : 0;
}

export function selectHuntNextEventAt(state: GameStoreState): string | undefined {
  return state.hunt ? state.hunt.nextEventAt : undefined;
}

export function selectHuntServerTime(state: GameStoreState): number | undefined {
  return state.hunt ? state.hunt.serverTime : undefined;
}

export function selectHuntWave(state: GameStoreState): number | undefined {
  return state.hunt ? state.hunt.wave : undefined;
}

export function selectHuntWaveRange(state: GameStoreState): HuntWaveRange | undefined {
  return state.hunt ? state.hunt.waveRange : undefined;
}

export function selectHuntingLocationId(state: GameStoreState): number | undefined {
  return state.hunt ? state.hunt.huntingLocationId : undefined;
}

export function selectPartyCreatureHealth(
  state: GameStoreState,
  creatureId: string,
): number | undefined {
  const health = partyCreatureHealth(state, creatureId);
  return health ? health.health : undefined;
}

export function selectPartyCreatureMaximumHealth(
  state: GameStoreState,
  creatureId: string,
): number | undefined {
  const health = partyCreatureHealth(state, creatureId);
  return health ? health.maximumHealth : undefined;
}

export function selectActiveCreatureElements(state: GameStoreState): Array<string> | undefined {
  return state.hunt ? state.hunt.activeCreatureElements : undefined;
}

export function selectActiveCreatureExperience(state: GameStoreState): string | undefined {
  return state.hunt ? state.hunt.activeCreatureExperience : undefined;
}

export function selectActiveCreatureExperienceLevelStart(
  state: GameStoreState,
): string | undefined {
  return state.hunt ? state.hunt.activeCreatureExperienceLevelStart : undefined;
}

export function selectActiveCreatureExperienceNextLevel(state: GameStoreState): string | undefined {
  return state.hunt ? state.hunt.activeCreatureExperienceNextLevel : undefined;
}

export function selectActiveCreatureName(state: GameStoreState): string | undefined {
  return state.hunt ? state.hunt.activeCreatureName : undefined;
}

export function selectActiveCreatureSpeciesId(state: GameStoreState): number | null | undefined {
  return state.hunt ? state.hunt.activeCreatureSpeciesId : undefined;
}

export function selectActiveCreatureSwitchCompletesAt(state: GameStoreState): number | undefined {
  return state.hunt ? state.hunt.activeCreatureSwitchCompletesAt : undefined;
}

export function selectActiveCreatureSwitchCooldownEndsAt(
  state: GameStoreState,
): number | undefined {
  return state.hunt ? state.hunt.activeCreatureSwitchCooldownEndsAt : undefined;
}

function partyCreatureHealth(
  state: GameStoreState,
  creatureId: string,
): PartyCreatureHealth | undefined {
  const hunt = state.hunt;
  if (!hunt) {
    return undefined;
  }
  function findHealth(candidate: PartyCreatureHealth): boolean {
    return candidate.creatureId === creatureId;
  }
  return hunt.partyHealth.find(findHealth);
}
