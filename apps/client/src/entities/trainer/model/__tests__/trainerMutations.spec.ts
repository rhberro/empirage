import { afterEach, beforeEach, expect, test } from 'bun:test';

import type { Trainer } from '@creatures/contracts/trainer';
import { QueryClient } from '@tanstack/react-query';

import {
  createTrainer,
  deleteTrainer,
  updateTrainer,
} from '~/entities/trainer/model/trainerMutations';
import type { ApiDeps, TrainerCreateResult } from '~/shared/api';
import { TRAINERS_QUERY_KEY, trainersQueryOptions } from '~/shared/api';

const BASE_URL = 'http://localhost:3001';
const STARTER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_NAME = 'Rafael';
const SHORT_NAME = 'ab';

type FetchHandler = (url: string) => Promise<Response>;

const DEPS: ApiDeps = {
  baseUrl: BASE_URL,
  getAccessToken: function getAccessToken(): Promise<string | null> {
    return Promise.resolve('access-token');
  },
};

let originalFetch: typeof globalThis.fetch;
let fetchCalls = 0;
let fetchHandler: FetchHandler = failUnexpectedFetch;

beforeEach(setupFetch);
afterEach(restoreFetch);

function setupFetch(): void {
  originalFetch = globalThis.fetch;
  fetchCalls = 0;
  fetchHandler = failUnexpectedFetch;
  globalThis.fetch = function fetchStub(input: RequestInfo | URL): Promise<Response> {
    fetchCalls += 1;
    return fetchHandler(String(input));
  } as unknown as typeof globalThis.fetch;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

function failUnexpectedFetch(): Promise<Response> {
  return Promise.reject(new Error('unexpected fetch call'));
}

function buildJsonResponse(body: unknown, status: number): Response {
  return new globalThis.Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

function buildTrainer(name: string, id: string): Trainer {
  return {
    createdAt: '2024-01-01T00:00:00.000Z',
    gender: 'male',
    id,
    level: 1,
    name,
    starterSpeciesId: STARTER_ID,
  };
}

function buildInput(name: string): { gender: 'male'; name: string; starterSpeciesId: string } {
  return { gender: 'male', name, starterSpeciesId: STARTER_ID };
}

function readTrainers(client: QueryClient): Trainer[] {
  return client.getQueryData<Trainer[]>(TRAINERS_QUERY_KEY) ?? [];
}

function isInvalidated(client: QueryClient): boolean {
  return client.getQueryState(TRAINERS_QUERY_KEY)?.isInvalidated === true;
}

function loadTheList(client: QueryClient, trainers: Trainer[]): Promise<void> {
  fetchHandler = buildListAnswer(trainers);
  return client.fetchQuery(trainersQueryOptions(DEPS)).then(ignoreAnswer);
}

function buildListAnswer(trainers: Trainer[]): FetchHandler {
  return function answer(): Promise<Response> {
    return Promise.resolve(buildJsonResponse({ trainers }, 200));
  };
}

function buildCreatedAnswer(): FetchHandler {
  return function answer(): Promise<Response> {
    return Promise.resolve(buildJsonResponse(buildTrainer(VALID_NAME, 'trainer-2'), 201));
  };
}

function buildUpdatedAnswer(): FetchHandler {
  return function answer(): Promise<Response> {
    return Promise.resolve(buildJsonResponse(buildTrainer('Ana Nova', 'trainer-1'), 200));
  };
}

function buildNoContentAnswer(): FetchHandler {
  return function answer(): Promise<Response> {
    return Promise.resolve(new globalThis.Response(null, { status: 204 }));
  };
}

function ignoreAnswer(): void {
  void 0;
}

/**
 * The creation writes the new trainer in the list and leaves the cache
 * behind: the server is asked again to confirm.
 */
function theCreationUpdatesTheList(): Promise<void> {
  const client = new QueryClient();
  return loadTheList(client, [buildTrainer('Ana', 'trainer-1')])
    .then(function createTheTrainer(): Promise<TrainerCreateResult> {
      fetchHandler = buildCreatedAnswer();
      return createTrainer(DEPS, buildInput(VALID_NAME), client);
    })
    .then(function assertCreation(result: TrainerCreateResult): void {
      expect(result.ok).toBe(true);
      expect(readTrainers(client)).toHaveLength(2);
      expect(isInvalidated(client)).toBe(true);
    });
}

function theEditionUpdatesTheList(): Promise<void> {
  const client = new QueryClient();
  return loadTheList(client, [buildTrainer('Ana', 'trainer-1')])
    .then(function updateTheTrainer(): Promise<unknown> {
      fetchHandler = buildUpdatedAnswer();
      return updateTrainer(DEPS, 'trainer-1', { name: 'Ana Nova' }, client);
    })
    .then(function assertEdition(): void {
      expect(readTrainers(client)[0]?.name).toBe('Ana Nova');
      expect(isInvalidated(client)).toBe(true);
    });
}

function theExclusionRemovesTheTrainer(): Promise<void> {
  const client = new QueryClient();
  return loadTheList(client, [buildTrainer('Ana', 'trainer-1'), buildTrainer('Bia', 'trainer-2')])
    .then(function deleteTheTrainer(): Promise<unknown> {
      fetchHandler = buildNoContentAnswer();
      return deleteTrainer(DEPS, 'trainer-1', client);
    })
    .then(function assertExclusion(): void {
      expect(readTrainers(client)).toHaveLength(1);
      expect(readTrainers(client)[0]?.id).toBe('trainer-2');
      expect(isInvalidated(client)).toBe(true);
    });
}

function anInvalidNameIsRefusedWithoutTheServer(): Promise<void> {
  const client = new QueryClient();
  const callsBefore = fetchCalls;
  return createTrainer(DEPS, buildInput(SHORT_NAME), client).then(function assertRefusal(
    result: TrainerCreateResult,
  ): void {
    expect(result.ok).toBe(false);
    expect(fetchCalls).toBe(callsBefore);
  });
}

function theExclusionOfAnUnknownTrainerSkipsTheServer(): Promise<void> {
  const client = new QueryClient();
  return loadTheList(client, [buildTrainer('Ana', 'trainer-1')])
    .then(function deleteTheTrainer(): Promise<unknown> {
      const callsBefore = fetchCalls;
      return deleteTrainer(DEPS, 'missing', client).then(function assertRefusal(): void {
        expect(fetchCalls).toBe(callsBefore);
      });
    })
    .then(ignoreAnswer);
}

test('the creation updates the list', theCreationUpdatesTheList);
test('the edition updates the list', theEditionUpdatesTheList);
test('the exclusion removes the trainer', theExclusionRemovesTheTrainer);
test('an invalid name is refused without the server', anInvalidNameIsRefusedWithoutTheServer);
test(
  'the exclusion of an unknown trainer skips the server',
  theExclusionOfAnUnknownTrainerSkipsTheServer,
);
