import { replace } from 'react-router-dom';

import { createPostAuthDeps, resolvePostAuth } from '~/features/authentication';
import type { PostAuthResolution } from '~/features/authentication';
import { getAuthStore, POST_AUTH_PATH, selectStatus, selectUser } from '~/shared/auth';
import type { AuthStatus, AuthStore } from '~/shared/auth';

const INITIALIZING: AuthStatus = 'INITIALIZING';
const RESET_PASSWORD_PATH = '/reset-password';
const SIGNIN_PATH = '/signin';

// Supabase emite o primeiro INITIAL_SESSION de forma assíncrona, então um loader
// que decide com o status ainda em INITIALIZING redirecionaria deep links válidos
// (retorno do OAuth, link de recuperação). Espera o primeiro status definitivo.
export function requireAuthLoader(): Promise<null> {
  return awaitSettledStatus(getAuthStore()).then(buildAuthGuard());
}

export function resetPasswordLoader(): Promise<null> {
  return awaitSettledStatus(getAuthStore()).then(buildResetGuard());
}

export function redirectIfAuthenticatedLoader(): Promise<null> {
  return awaitSettledStatus(getAuthStore()).then(redirectIfAuthenticated);
}

export function redirectIfAuthenticatedOrRecoveringLoader(): Promise<null> {
  return awaitSettledStatus(getAuthStore()).then(redirectIfAuthenticatedOrRecovering);
}

/**
 * Where the player lands after an authentication that came from outside.
 *
 * The OAuth return and the confirmation e-mail link both come back as a full
 * page load, and both carry the session in the URL. This route waits for the
 * session to settle, merges a Google session with the account that has the
 * same e-mail, and then sends the player to the list of the trainers. The
 * list is read by the screen itself, in a query that the whole client shares:
 * an account without a trainer goes on to the screen that creates one.
 */
export function postAuthLoader(): Promise<null> {
  const store = getAuthStore();
  return awaitSettledStatus(store).then(buildPostAuthGuard(store)).then(redirectToDestination);
}

export function notFoundLoader(): never {
  throw replace(SIGNIN_PATH);
}

function redirectIfAuthenticated(status: AuthStatus): null {
  if (status === 'AUTHENTICATED') {
    throw replace(POST_AUTH_PATH);
  }
  return null;
}

// Durante RECOVERING o usuário tem uma sessão parcial e pertence à tela de reset,
// então volta para lá em vez de ficar preso num formulário de entrada. O loader
// "puro" fica em /forgot-password porque o "Voltar" da tela de reset aponta para
// lá: redirecionar RECOVERING de /forgot-password criaria um loop.
function redirectIfAuthenticatedOrRecovering(status: AuthStatus): null {
  if (status === 'RECOVERING') {
    throw replace(RESET_PASSWORD_PATH);
  }
  return redirectIfAuthenticated(status);
}

function awaitSettledStatus(store: AuthStore): Promise<AuthStatus> {
  const status = selectStatus(store.getState());
  if (status !== INITIALIZING) {
    return Promise.resolve(status);
  }
  return new Promise(buildStatusWaiter(store));
}

function buildStatusWaiter(store: AuthStore): (resolve: (status: AuthStatus) => void) => void {
  return function wait(resolve): void {
    const unsubscribe = store.subscribe(function onStatusChanged(state): void {
      const status = selectStatus(state);
      if (status !== INITIALIZING) {
        unsubscribe();
        resolve(status);
      }
    });
  };
}

function buildAuthGuard(): (status: AuthStatus) => null {
  return function guard(status): null {
    if (status === 'AUTHENTICATED') {
      return null;
    }
    throw replace(SIGNIN_PATH);
  };
}

function buildResetGuard(): (status: AuthStatus) => null {
  return function guard(status): null {
    if (status === 'RECOVERING' || status === 'AUTHENTICATED') {
      return null;
    }
    throw replace(SIGNIN_PATH);
  };
}

function buildPostAuthGuard(store: AuthStore): (status: AuthStatus) => Promise<string> {
  return function guard(status): Promise<string> {
    if (status !== 'AUTHENTICATED') {
      throw replace(SIGNIN_PATH);
    }
    const user = selectUser(store.getState());
    return resolvePostAuth(user, createPostAuthDeps()).then(readResolvedDestination);
  };
}

function readResolvedDestination(resolution: PostAuthResolution): string {
  // O resultado do merge é descartado de propósito: a sessão já é válida e um
  // merge que falhou não pode trancar a pessoa fora do jogo.
  return resolution.destination;
}

function redirectToDestination(destination: string): never {
  throw replace(destination);
}
