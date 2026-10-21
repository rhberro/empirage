import { afterEach, beforeEach, expect, test } from 'bun:test';

import type { ApiDeps } from '~/shared/api/client';

import { requestWsTicket } from './wsTicket';

const BASE_URL = 'http://localhost:3001';
const WS_TICKET_PATH = '/api/ws-ticket';

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

const DEPS_WITHOUT_TOKEN: ApiDeps = {
  baseUrl: BASE_URL,
  getAccessToken: function getAccessToken(): Promise<string | null> {
    return Promise.resolve(null);
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

function theTicketIsAsked(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    return buildJson(200, { expiresAt: 1700000000000, ticket: 'ticket-1' });
  });
  return requestWsTicket(DEPS).then(function assertTicket(result): void {
    expect(result).toEqual({ expiresAt: 1700000000000, ok: true, ticket: 'ticket-1' });
    expect(fetchCalls).toBe(1);
    expect(requestedUrls[0]).toBe(`${BASE_URL}${WS_TICKET_PATH}`);
  });
}

function aSessionWithoutTokenIsNotEvenAsked(): Promise<void> {
  globalThis.fetch = fetchThatFails as unknown as typeof globalThis.fetch;
  return requestWsTicket(DEPS_WITHOUT_TOKEN).then(function assertRefusal(result): void {
    expect(result).toEqual({ code: 'unauthenticated', ok: false });
    expect(fetchCalls).toBe(0);
  });
}

function fetchThatFails(): Promise<Response> {
  fetchCalls += 1;
  return Promise.reject(new Error('the request should not be made'));
}

function aRefusalCarriesTheCode(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    return buildJson(401, { error: 'unauthenticated' });
  });
  return requestWsTicket(DEPS).then(function assertRefusal(result): void {
    expect(result).toEqual({ code: 'unauthenticated', ok: false });
  });
}

function aTicketWithoutAnExpiryIsAFailure(): Promise<void> {
  stubFetch(function answer(): FakeResponse {
    return buildJson(200, { ticket: 'ticket-1' });
  });
  return requestWsTicket(DEPS).then(function assertRefusal(result): void {
    expect(result).toEqual({ code: 'unknown', ok: false });
  });
}

test('the ticket is asked for the websocket', theTicketIsAsked);
test('a session without a token is not even asked', aSessionWithoutTokenIsNotEvenAsked);
test('a refusal carries the code of the server', aRefusalCarriesTheCode);
test('a ticket without an expiry is a failure', aTicketWithoutAnExpiryIsAFailure);
