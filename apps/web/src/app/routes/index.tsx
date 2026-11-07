import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter, redirect } from 'react-router-dom';

import { authenticatedLoader, guestLoader } from './guards';

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
    Component: lazy(loadCreateCharacterPage),
    loader: authenticatedLoader,
    path: '/create-character',
  },
  {
    Component: lazy(loadCharactersPage),
    loader: authenticatedLoader,
    path: '/characters',
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

function loadCreateCharacterPage(): Promise<typeof import('~/pages/create-character')> {
  return import('~/pages/create-character');
}

function loadCharactersPage(): Promise<typeof import('~/pages/characters')> {
  return import('~/pages/characters');
}

function loadDesignSystemPage(): Promise<typeof import('~/pages/design-system')> {
  return import('~/pages/design-system');
}
