import { redirect } from 'react-router-dom';

import { apiRequest } from '~/shared/api';
import { authStore, waitForAuthInitialization } from '~/shared/auth';

type CharacterSelection = { is_selected: boolean };
type CharacterSelections = Array<CharacterSelection>;

function isSelected(character: CharacterSelection): boolean {
  return character.is_selected;
}

export async function authenticatedDestinationLoader(): Promise<null | Response> {
  await waitForAuthInitialization();
  if (authStore.getState().status !== 'authenticated') {
    return null;
  }

  const characters = await apiRequest<CharacterSelections>('/characters');
  const hasSelectedCharacter = characters.some(isSelected);

  return redirect(hasSelectedCharacter ? '/game' : '/characters');
}

export async function authenticatedLoader(): Promise<null | Response> {
  await waitForAuthInitialization();
  if (authStore.getState().status !== 'authenticated') {
    return redirect('/signin');
  }
  return null;
}

export async function guestLoader(): Promise<null | Response> {
  await waitForAuthInitialization();
  if (authStore.getState().status === 'authenticated') {
    return redirect('/');
  }
  return null;
}
