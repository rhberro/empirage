import type { AuthError, Session } from '@supabase/supabase-js';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { supabase } from '../api';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export type AuthState = { error: AuthError | null; session: Session | null; status: AuthStatus };

export type SignInCredentials = { email: string; password: string };

export type SignUpCredentials = { email: string; password: string };

export type AuthSelector<T> = (state: AuthState) => T;

const initialState: AuthState = { error: null, session: null, status: 'initializing' };

function createInitialState(): AuthState {
  return initialState;
}

export const authStore = createStore<AuthState>()(createInitialState);

function updateAuthState(session: Session | null, error: AuthError | null): void {
  const current = authStore.getState();
  const status = session ? 'authenticated' : 'unauthenticated';
  const currentToken = current.session ? current.session.access_token : null;
  const nextToken = session ? session.access_token : null;

  if (currentToken === nextToken && current.status === status && current.error === error) {
    return;
  }

  const nextState: AuthState = { error, session, status };
  authStore.setState(nextState);
}

export function selectAuthSession(state: AuthState): Session | null {
  return state.session;
}

export function selectAuthError(state: AuthState): AuthError | null {
  return state.error;
}

export function selectAuthStatus(state: AuthState): AuthStatus {
  return state.status;
}

export function useAuthStore<T>(selector: AuthSelector<T>): T {
  return useStore(authStore, selector);
}

let initialized = false;

let authInitializationComplete = false;

type AuthInitializationResolver = (value: void | PromiseLike<void>) => void;

let resolveAuthInitialization: AuthInitializationResolver | undefined;

function initializeAuthInitializationPromise(resolve: AuthInitializationResolver): void {
  resolveAuthInitialization = resolve;
}

const authInitializationPromise = new Promise<void>(initializeAuthInitializationPromise);

function handleAuthStateChange(event: string, session: Session | null): void {
  if (
    event === 'INITIAL_SESSION' ||
    event === 'SIGNED_IN' ||
    event === 'SIGNED_OUT' ||
    event === 'TOKEN_REFRESHED' ||
    event === 'USER_UPDATED'
  ) {
    updateAuthState(session, null);
  }

  if (event === 'INITIAL_SESSION' && !authInitializationComplete) {
    authInitializationComplete = true;
    if (resolveAuthInitialization) {
      resolveAuthInitialization();
    }
  }
}

export function initializeAuth(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  supabase.auth.onAuthStateChange(handleAuthStateChange);
}

export async function waitForAuthInitialization(): Promise<void> {
  initializeAuth();

  if (authInitializationComplete) {
    return;
  }

  await authInitializationPromise;
}

export async function signIn(credentials: SignInCredentials): Promise<boolean> {
  const current = authStore.getState();
  if (current.error) {
    const clearedError = { error: null };
    authStore.setState(clearedError);
  }

  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    updateAuthState(authStore.getState().session, error);
    return false;
  }

  updateAuthState(data.session, null);
  return true;
}

export async function signUp(credentials: SignUpCredentials): Promise<boolean> {
  const current = authStore.getState();
  if (current.error) {
    const clearedError = { error: null };
    authStore.setState(clearedError);
  }

  const { data, error } = await supabase.auth.signUp(credentials);
  if (error) {
    updateAuthState(authStore.getState().session, error);
    return false;
  }

  updateAuthState(data.session, null);
  return Boolean(data.session);
}

export async function signOut(): Promise<boolean> {
  const current = authStore.getState();
  if (current.error) {
    const clearedError = { error: null };
    authStore.setState(clearedError);
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    updateAuthState(authStore.getState().session, error);
    return false;
  }

  updateAuthState(null, error);
  return true;
}

export function getAccessToken(): string | null {
  const session = authStore.getState().session;
  return session ? session.access_token : null;
}
