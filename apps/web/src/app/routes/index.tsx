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
