import { afterEach, beforeEach, expect, test } from 'bun:test';

import type { ApiDeps } from '~/shared/api';
import { requestHuntArea, requestHuntAreaList } from '~/shared/api';

const BASE_URL = 'http://localhost:3001';
const AREA_ID = '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01';

type FakeResponse = {
  json(): Promise<unknown>;
  status: number;
};

const DEPS: ApiDeps = {
  baseUrl: BASE_URL,
  getAccessToken: function getAccessToken(): Promise<string | null> {
    return Promise.resolve('access-token');
  },
};

let originalFetch: typeof globalThis.fetch;

beforeEach(saveOriginalFetch);
afterEach(restoreOriginalFetch);

function saveOriginalFetch(): void {
  originalFetch = globalThis.fetch;
}

function restoreOriginalFetch(): void {
  globalThis.fetch = originalFetch;
}

function buildJson(status: number, body: unknown): FakeResponse {
  return {
    json: function json(): Promise<unknown> {
      return Promise.resolve(body);
    },
    status,
  };
}

function stubFetch(answer: (url: string) => FakeResponse): void {
  globalThis.fetch = function fetchStub(input: RequestInfo | URL): Promise<Response> {
    return Promise.resolve(answer(String(input)) as unknown as Response);
  } as unknown as typeof globalThis.fetch;
}

function buildSpecies(id: string, name: string, element: string): unknown {
  return {
    species: { element, id, name, slug: id },
    tone: 'ember',
  };
}

function buildAreaBody(): unknown {
  return {
    areas: [
      {
        description: 'Campina coberta de cinzas.',
        id: AREA_ID,
        minimumLevel: 1,
        name: 'Campina Cinzenta',
        primarySpecies: buildSpecies('brasa', 'Brasa', 'fire'),
        recommendedLevel: 3,
        slug: 'campina-cinzenta',
        species: [buildSpecies('brasa', 'Brasa', 'fire'), buildSpecies('broto', 'Broto', 'plant')],
        tone: 'ember',
      },
    ],
  };
}

function buildDetailBody(): unknown {
  return {
    description: 'Campina coberta de cinzas.',
    id: AREA_ID,
    items: [
      {
        category: 'material',
        itemId: 'pata-de-criatura',
        name: 'Pata de Criatura',
        slug: 'pata-de-criatura',
        tone: 'gold',
      },
    ],
    minimumLevel: 1,
    name: 'Campina Cinzenta',
    primarySpecies: buildSpecies('brasa', 'Brasa', 'fire'),
    recommendedLevel: 3,
    slug: 'campina-cinzenta',
    species: [buildSpecies('brasa', 'Brasa', 'fire'), buildSpecies('broto', 'Broto', 'plant')],
    tone: 'ember',
  };
}

function theListIsRead(): Promise<void> {
  stubFetch(buildAreaAnswer);
  return requestHuntAreaList(DEPS).then(function assertAreas(result): void {
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0]?.name).toBe('Campina Cinzenta');
    expect(result.areas[0]?.species).toHaveLength(2);
    expect(result.areas[0]?.tone).toBe('ember');
  });
}

function buildAreaAnswer(): FakeResponse {
  return buildJson(200, buildAreaBody());
}

function buildDetailAnswer(): FakeResponse {
  return buildJson(200, buildDetailBody());
}

function buildNotFoundAnswer(): FakeResponse {
  return buildJson(404, { error: 'trainer_not_found' });
}

function theDetailIsRead(): Promise<void> {
  stubFetch(buildDetailAnswer);
  return requestHuntArea(DEPS, AREA_ID).then(function assertArea(result): void {
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.area.items).toHaveLength(1);
    expect(result.area.items[0]?.name).toBe('Pata de Criatura');
    expect(result.area.primarySpecies.species.name).toBe('Brasa');
  });
}

function anUnknownAreaIsNotFound(): Promise<void> {
  stubFetch(buildNotFoundAnswer);
  return requestHuntArea(DEPS, 'missing').then(function assertCode(result): void {
    expect(result).toEqual({ code: 'trainer_not_found', ok: false });
  });
}

function aNetworkFailureIsAFailure(): Promise<void> {
  globalThis.fetch = fetchThatFails as unknown as typeof globalThis.fetch;
  return requestHuntAreaList(DEPS).then(function assertCode(result): void {
    expect(result).toEqual({ code: 'unknown', ok: false });
  });
}

function fetchThatFails(): Promise<Response> {
  return Promise.reject(new Error('the server is unreachable'));
}

function theRequestGoesToTheHuntAreasEndpoint(): Promise<void> {
  const urls: string[] = [];
  globalThis.fetch = function fetchStub(input: RequestInfo | URL): Promise<Response> {
    urls.push(String(input));
    return Promise.resolve(buildJson(200, buildAreaBody()) as unknown as Response);
  } as unknown as typeof globalThis.fetch;
  return requestHuntAreaList(DEPS).then(function assertUrl(): void {
    expect(urls[0]).toBe(`${BASE_URL}/api/hunt-areas`);
  });
}

test('the list of areas is read', theListIsRead);
test('the detail of an area is read', theDetailIsRead);
test('an unknown area is not found', anUnknownAreaIsNotFound);
test('a network failure is a failure', aNetworkFailureIsAFailure);
test('the request goes to the hunt areas endpoint', theRequestGoesToTheHuntAreasEndpoint);
