import { redirect } from 'react-router-dom';

import type { Character, CharacterId } from '~/entities/character';
import { ApiError, apiRequest } from '~/shared/api';
import { authStore, invalidateSession, waitForAuthInitialization } from '~/shared/auth';
import { getSelectedCharacter, setSelectedCharacter } from '~/shared/session';

type ActiveHunt = { character_id: CharacterId } | null;

type CharacterReferences = Array<Pick<Character, 'id'>>;

type LoaderResponse = ReturnType<typeof redirect>;

function getActiveHunt(): Promise<ActiveHunt> {
  return apiRequest<ActiveHunt>('/characters/active-hunt');
}

function getCharacters(): Promise<CharacterReferences> {
  return apiRequest<CharacterReferences>('/characters');
}

async function getAuthenticatedUserId(): Promise<string | null> {
  await waitForAuthInitialization();
  const state = authStore.getState();
  if (state.status !== 'authenticated' || !state.session) {
    return null;
  }
  return state.session.user.id;
}

function hasCharacter(characters: CharacterReferences, selectedCharacterId: CharacterId): boolean {
  for (const character of characters) {
    if (character.id === selectedCharacterId) {
      return true;
    }
  }
  return false;
}

async function handleInvalidAccessToken(error: unknown): Promise<null | LoaderResponse> {
  if (!(error instanceof ApiError) || error.code !== 'invalid_access_token') {
    throw error;
  }

  await invalidateSession();
  return redirect('/signin');
}

export async function authenticatedLoader(): Promise<null | LoaderResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return redirect('/signin');
  }
  return null;
}

export async function characterListLoader(): Promise<null | LoaderResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return redirect('/signin');
  }
  try {
    const activeHunt = await getActiveHunt();
    if (activeHunt) {
      setSelectedCharacter(userId, activeHunt.character_id);
      return redirect('/game');
    }
    return null;
  } catch (error) {
    return handleInvalidAccessToken(error);
  }
}

export async function gameLoader(): Promise<null | LoaderResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return redirect('/signin');
  }

  try {
    const activeHunt = await getActiveHunt();
    if (activeHunt) {
      setSelectedCharacter(userId, activeHunt.character_id);
      return null;
    }

    const selectedCharacterId = getSelectedCharacter(userId);
    if (!selectedCharacterId) {
      return redirect('/characters');
    }

    const characters = await getCharacters();
    const hasSelectedCharacter = hasCharacter(characters, selectedCharacterId);
    if (!hasSelectedCharacter) {
      return redirect('/characters');
    }

    return null;
  } catch (error) {
    return handleInvalidAccessToken(error);
  }
}

export async function guestLoader(): Promise<null | LoaderResponse> {
  await waitForAuthInitialization();
  if (authStore.getState().status === 'authenticated') {
    return redirect('/characters');
  }
  return null;
}
