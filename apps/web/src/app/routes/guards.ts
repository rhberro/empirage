import { redirect } from 'react-router-dom';

import { authStore, waitForAuthInitialization } from '~/shared/auth';

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
