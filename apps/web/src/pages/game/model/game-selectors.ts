import type { CollectionStateEvent } from '../api/game-protocol';
import type { PartyCreatureHealth } from '../api/hunt-protocol';
import type { GameStoreState } from './game-store';

type Party = CollectionStateEvent['collection']['party'];

const EMPTY_PARTY: Party = [];

export function selectParty(state: GameStoreState): Party {
  return state.collection ? state.collection.party : EMPTY_PARTY;
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
