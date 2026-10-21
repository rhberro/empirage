import { expect, test } from 'bun:test';

import type { Server } from 'bun';

import type { ServerDependencies } from '~/dependencies';
import type { UserReader } from '~/supabase';
import type { SocketData } from '~/ws/connections';
import { createWebSocketUpgrade } from '~/ws/upgrade';

import { USER_ID, buildDependencies } from './support';

const OTHER_USER_ID = 'user-2';
const TOKEN = 'token-of-the-account';
const WS_URL = 'http://localhost/ws';

/**
 * The server of the test: it records what the upgrade asked for.
 */
type FakeServer = {
  data: SocketData | null;
  upgrade(req: Request, options: { data: SocketData }): boolean;
};

function buildFakeServer(): FakeServer {
  const server: FakeServer = {
    data: null,
    upgrade: function upgrade(_req: Request, options: { data: SocketData }): boolean {
      server.data = options.data;
      return true;
    },
  };
  return server;
}

function buildUsers(readUserId: (token: string) => Promise<string | null>): UserReader {
  return { readUserId };
}

function buildRequest(ticket: string): Request {
  return new globalThis.Request(`${WS_URL}?ticket=${ticket}`);
}

function issueTicket(deps: ServerDependencies, userId: string = USER_ID): string {
  return deps.tickets.issue(userId, TOKEN).ticket;
}

/**
 * The channel opens for a ticket whose token is still a session the Auth
 * server knows.
 */
function opensTheChannelOfTheAccount(): Promise<void> {
  const deps = buildDependencies({
    users: buildUsers(function readUserId(): Promise<string | null> {
      return Promise.resolve(USER_ID);
    }),
  });
  const upgrade = createWebSocketUpgrade(deps);
  const server = buildFakeServer();
  const ticket = issueTicket(deps);
  return upgrade(buildRequest(ticket), server as unknown as Server<SocketData>).then(
    function assertOpened(response: Response | undefined): void {
      expect(response).toBeUndefined();
      expect(server.data?.userId).toBe(USER_ID);
    },
  );
}

/**
 * A session that was revoked does not open the channel: the token keeps being
 * valid, and the Auth server is the only one that knows the session is over.
 */
function refusesARevokedSession(): Promise<void> {
  const deps = buildDependencies({
    users: buildUsers(function readUserId(): Promise<string | null> {
      return Promise.resolve(null);
    }),
  });
  const upgrade = createWebSocketUpgrade(deps);
  const server = buildFakeServer();
  const ticket = issueTicket(deps);
  return upgrade(buildRequest(ticket), server as unknown as Server<SocketData>).then(
    function assertRefused(response: Response | undefined): void {
      expect(response?.status).toBe(401);
      expect(server.data).toBeNull();
    },
  );
}

/**
 * The token of the ticket cannot open the channel of another account.
 */
function refusesATokenOfAnotherAccount(): Promise<void> {
  const deps = buildDependencies({
    users: buildUsers(function readUserId(): Promise<string | null> {
      return Promise.resolve(OTHER_USER_ID);
    }),
  });
  const upgrade = createWebSocketUpgrade(deps);
  const server = buildFakeServer();
  const ticket = issueTicket(deps);
  return upgrade(buildRequest(ticket), server as unknown as Server<SocketData>).then(
    function assertRefused(response: Response | undefined): void {
      expect(response?.status).toBe(401);
      expect(server.data).toBeNull();
    },
  );
}

/**
 * The ticket is of single use: the same value never opens two channels.
 */
function refusesATicketThatWasAlreadyUsed(): Promise<void> {
  const deps = buildDependencies({
    users: buildUsers(function readUserId(): Promise<string | null> {
      return Promise.resolve(USER_ID);
    }),
  });
  const upgrade = createWebSocketUpgrade(deps);
  const server = buildFakeServer();
  const ticket = issueTicket(deps);
  return upgrade(buildRequest(ticket), server as unknown as Server<SocketData>)
    .then(function openAgain(): Promise<Response | undefined> {
      return upgrade(buildRequest(ticket), server as unknown as Server<SocketData>);
    })
    .then(function assertRefused(response: Response | undefined): void {
      expect(response?.status).toBe(401);
    });
}

function refusesAMissingTicket(): Promise<void> {
  const deps = buildDependencies();
  const upgrade = createWebSocketUpgrade(deps);
  const server = buildFakeServer();
  const request = new globalThis.Request(WS_URL);
  return upgrade(request, server as unknown as Server<SocketData>).then(function assertRefused(
    response: Response | undefined,
  ): void {
    expect(response?.status).toBe(401);
    expect(server.data).toBeNull();
  });
}

test('the upgrade opens the channel of the account', opensTheChannelOfTheAccount);
test('the upgrade refuses a revoked session', refusesARevokedSession);
test('the upgrade refuses a token of another account', refusesATokenOfAnotherAccount);
test('the upgrade refuses a ticket that was already used', refusesATicketThatWasAlreadyUsed);
test('the upgrade refuses a missing ticket', refusesAMissingTicket);
