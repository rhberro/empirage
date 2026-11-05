import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter } from 'react-router-dom';

type Route = Array<RouteObject>;

const ROUTES: Route = [
  {
    Component: lazy(loadSignInPage),
    // loader: redirectIfAuthenticatedOrRecoveringLoader,
    path: '/signin',
  },
  {
    Component: lazy(loadSignUpPage),
    // loader: redirectIfAuthenticatedOrRecoveringLoader,
    path: '/signup',
  },
  {
    Component: lazy(loadCreateCharacterPage),
    // loader: redirectIfAuthenticatedOrRecoveringLoader,
    path: '/create-character',
  },
  {
    Component: lazy(loadCharactersPage),
    // loader: redirectIfAuthenticatedOrRecoveringLoader,
    path: '/characters',
  },
  {
    Component: lazy(loadDesignSystemPage),
    // loader: redirectIfAuthenticatedOrRecoveringLoader,
    path: '/design-system',
  },
  {
    Component: null,
    // loader: notFoundLoader,
    path: '*',
  },
];

export const router = createBrowserRouter(ROUTES);

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
