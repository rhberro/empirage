import { afterEach, beforeEach, expect, test } from 'bun:test';

import type { PlayerState } from '@creatures/contracts/player';

import type { ApiDeps } from '~/shared/api/client';

import { requestPlayerState } from './player';

const BASE_URL = 'http://localhost:3001';
const PLAYER_STATE_PATH = '/api/player/state';
const REV = 7;

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

function stubFetch(answer: () => FakeResponse): void {
  globalThis.fetch = function fetchStub(input: RequestInfo | URL): Promise<Response> {
    fetchCalls += 1;
    requestedUrls.push(String(input));
    return Promise.resolve(answer() as unknown as Response);
  } as unknown as typeof globalThis.fetch;
}

function buildJson(status: number, body: unknown): FakeResponse {
  return {
    json: function json(): Promise<unknown> {
      return Promise.resolve(body);
    },
    status,
  };
}

function buildStateBody(): unknown {
  return {
    activeAbilities: [],
    activeCreatureId: null,
    activeVitals: null,
    backpack: [],
    diamonds: 0,
    epoch: 'epoch-1',
    equippedAbilities: [],
    equippedConsumables: [],
    equippedDevice: null,
    gold: 10,
    maxStaminaMinutes: 60,
    rev: REV,
    serverNow: 1700000000000,
    staminaMinutes: 30,
    storage: [],
    team: [],
    trainer: { id: 'trainer-1' },
  };
}

function theStateIsAskedWithoutARevision(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    return buildJson(200, buildStateBody());
  });
  return requestPlayerState(DEPS).then(function assertState(result): void {
    expect(result.ok).toBe(true);
    expect(requestedUrls[0]).toBe(`${BASE_URL}${PLAYER_STATE_PATH}`);
  });
}

function theRevisionTravelsInTheQuery(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    return buildJson(200, buildStateBody());
  });
  return requestPlayerState(DEPS, REV).then(function assertState(result): void {
    expect(result.ok).toBe(true);
    expect(requestedUrls[0]).toBe(`${BASE_URL}${PLAYER_STATE_PATH}?sinceRev=${REV}`);
  });
}

function nothingNewIsNotAFailure(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    return buildJson(204, null);
  });
  return requestPlayerState(DEPS, REV).then(function assertState(result): void {
    expect(result).toEqual({ ok: true, state: null });
  });
}

function aStateWithoutTheRevisionIsRefused(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    const body = buildStateBody() as Record<string, unknown>;
    delete body.rev;
    return buildJson(200, body);
  });
  return requestPlayerState(DEPS).then(function assertState(result): void {
    expect(result.ok).toBe(false);
  });
}

function aStateWithTheRevisionIsAccepted(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    return buildJson(200, buildStateBody());
  });
  return requestPlayerState(DEPS).then(function assertState(result): void {
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const state: PlayerState = result.state;
    expect(state.rev).toBe(REV);
    expect(state.epoch).toBe('epoch-1');
    expect(state.serverNow).toBe(1700000000000);
  });
}

test('the state is asked without a revision', theStateIsAskedWithoutARevision);
test('the revision travels in the query', theRevisionTravelsInTheQuery);
test('nothing new is not a failure', nothingNewIsNotAFailure);
test('a state without the revision is refused', aStateWithoutTheRevisionIsRefused);
test('a state with the revision is accepted', aStateWithTheRevisionIsAccepted);
