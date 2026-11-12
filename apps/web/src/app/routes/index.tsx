import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter, redirect } from 'react-router-dom';

import { characterListLoader, gameLoader, guestLoader } from './guards';

type Route = Array<RouteObject>;

const ROUTES: Route = [
  {
    Component: lazy(loadHomePage),
    path: '/',
  },
  {
    Component: lazy(loadDesignSystemPage),
    path: '/design-system',
  },
  {
    Component: lazy(loadSignInPage),
    loader: guestLoader,
    path: '/signin',
  },
  {
    Component: lazy(loadSignUpPage),
    loader: guestLoader,
    path: '/signup',
  },
  {
    Component: lazy(loadNewCharacterPage),
    loader: characterListLoader,
    path: '/characters/new',
  },
  {
    Component: lazy(loadCharactersPage),
    loader: characterListLoader,
    path: '/characters',
  },
  {
    Component: lazy(loadGamePage),
    loader: gameLoader,
    path: '/game',
  },
  {
    Component: null,
    loader() {
      throw redirect('/');
    },
    path: '*',
  },
];

export const router = createBrowserRouter(ROUTES);

function loadHomePage(): Promise<typeof import('~/pages/home')> {
  return import('~/pages/home');
}

function loadSignInPage(): Promise<typeof import('~/pages/sign-in')> {
  return import('~/pages/sign-in');
}

function loadSignUpPage(): Promise<typeof import('~/pages/sign-up')> {
  return import('~/pages/sign-up');
}

function loadNewCharacterPage(): Promise<typeof import('~/pages/new-character')> {
  return import('~/pages/new-character');
}

function loadCharactersPage(): Promise<typeof import('~/pages/characters')> {
  return import('~/pages/characters');
}

function loadGamePage(): Promise<typeof import('~/pages/game')> {
  return import('~/pages/game');
}

function loadDesignSystemPage(): Promise<typeof import('~/pages/design-system')> {
  return import('~/pages/design-system');
}
