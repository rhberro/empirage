import { afterEach, beforeEach, expect, test } from 'bun:test';

import { QueryClient } from '@tanstack/react-query';

import type { ApiDeps } from '~/shared/api/client';

import { huntAreaListQueryOptions, huntAreaQueryOptions } from './huntAreaQueries';
import { startersQueryOptions } from './starterQueries';
import { trainersQueryOptions } from './trainerQueries';

const BASE_URL = 'http://localhost:3001';
const AREA_ID = 'area-1';

const DEPS: ApiDeps = {
  baseUrl: BASE_URL,
  getAccessToken: function getAccessToken(): Promise<string | null> {
    return Promise.resolve('access-token');
  },
};

let originalFetch: typeof globalThis.fetch;
let fetchCalls = 0;
let requestedUrls: string[] = [];

beforeEach(saveOriginalFetch);
afterEach(restoreOriginalFetch);

function saveOriginalFetch(): void {
  originalFetch = globalThis.fetch;
  fetchCalls = 0;
  requestedUrls = [];
}

function restoreOriginalFetch(): void {
  globalThis.fetch = originalFetch;
}

function stubFetch(answer: (url: string) => unknown): void {
  globalThis.fetch = function fetchStub(input: RequestInfo | URL): Promise<Response> {
    fetchCalls += 1;
    requestedUrls.push(String(input));
    return Promise.resolve(answer(String(input)) as unknown as Response);
  } as unknown as typeof globalThis.fetch;
}

function buildJson(status: number, body: unknown): Response {
  return new globalThis.Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

/**
 * Two screens that ask for the list at the same time wait for the request
 * that is already running: the list is asked once.
 */
function theListIsAskedOnceForTwoReaders(): Promise<void> {
  stubFetch(function answer(): unknown {
    return buildJson(200, { trainers: [] });
  });
  const client = new QueryClient();
  const first = client.fetchQuery(trainersQueryOptions(DEPS));
  const second = client.fetchQuery(trainersQueryOptions(DEPS));
  return Promise.all([first, second]).then(function assertCalls(): void {
    expect(fetchCalls).toBe(1);
  });
}

/**
 * The content that only changes with a deploy stays in the cache: reading it
 * again does not go to the network.
 */
function theStartersAreReadOnceInsideTheWindow(): Promise<void> {
  stubFetch(function answer(): unknown {
    return buildJson(200, { starters: [] });
  });
  const client = new QueryClient();
  return client
    .fetchQuery(startersQueryOptions(DEPS))
    .then(function readAgain(): Promise<unknown> {
      return client.fetchQuery(startersQueryOptions(DEPS));
    })
    .then(function assertCalls(): void {
      expect(fetchCalls).toBe(1);
    });
}

function theHuntAreasAreReadOnceInsideTheWindow(): Promise<void> {
  stubFetch(function answer(): unknown {
    return buildJson(200, { areas: [] });
  });
  const client = new QueryClient();
  return client
    .fetchQuery(huntAreaListQueryOptions(DEPS))
    .then(function readAgain(): Promise<unknown> {
      return client.fetchQuery(huntAreaListQueryOptions(DEPS));
    })
    .then(function assertCalls(): void {
      expect(fetchCalls).toBe(1);
    });
}

function oneHuntAreaIsReadOnceInsideTheWindow(): Promise<void> {
  stubFetch(function answer(): unknown {
    return buildJson(200, buildHuntAreaBody());
  });
  const client = new QueryClient();
  return client
    .fetchQuery(huntAreaQueryOptions(DEPS, AREA_ID))
    .then(function readAgain(): Promise<unknown> {
      return client.fetchQuery(huntAreaQueryOptions(DEPS, AREA_ID));
    })
    .then(function assertCalls(): void {
      expect(fetchCalls).toBe(1);
      expect(requestedUrls[0]).toBe(`${BASE_URL}/api/hunt-areas/${AREA_ID}`);
    });
}

function buildHuntAreaBody(): unknown {
  return {
    description: 'A place of the hunt.',
    id: AREA_ID,
    items: [],
    minimumLevel: 1,
    name: 'Campo',
    primarySpecies: {
      species: { element: 'neutral', id: 'species-1', name: 'Musguim', slug: 'musguim' },
    },
    recommendedLevel: 3,
    slug: 'campo',
    species: [],
    tone: 'neutral',
  };
}

test('the list is asked once for two readers', theListIsAskedOnceForTwoReaders);
test('the starters are read once inside the window', theStartersAreReadOnceInsideTheWindow);
test('the hunt areas are read once inside the window', theHuntAreasAreReadOnceInsideTheWindow);
test('one hunt area is read once inside the window', oneHuntAreaIsReadOnceInsideTheWindow);
