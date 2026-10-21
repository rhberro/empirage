import { expect, test } from 'bun:test';

import {
  HEALTH_PATH,
  NO_CONTENT,
  NOT_FOUND,
  OK,
  PLAYER_STATE_PATH,
  SESSION_PATH,
  STARTERS_PATH,
  TRAINERS_PATH,
  UNAUTHORIZED,
  USER_ID,
  USER_TOKEN,
  WS_TICKET_PATH,
  buildDependencies,
  buildEmptyAdmin,
  buildHandler,
  buildJsonRequest,
  buildRequest,
  buildTrainerAdmin,
  readError,
  readJson,
  registerFakeConnection,
  send,
} from './support';

const STARTER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const TRAINER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_NAME = 'Rafael';

function expectUnauthenticated(method: string, path: string, body?: unknown): Promise<void> {
  const handler = buildHandler();
  const request =
    body === undefined
      ? buildRequest(method, path, null)
      : buildJsonRequest(method, path, body, null);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(UNAUTHORIZED);
    return readError(response).then(assertUnauthenticatedCode);
  });
}

function assertUnauthenticatedCode(error: { error: string }): void {
  expect(error.error).toBe('unauthenticated');
}

function trainerListRequiresAuth(): Promise<void> {
  return expectUnauthenticated('GET', TRAINERS_PATH);
}

function trainerCreationRequiresAuth(): Promise<void> {
  return expectUnauthenticated('POST', TRAINERS_PATH, {
    gender: 'male',
    name: VALID_NAME,
    starterSpeciesId: STARTER_ID,
  });
}

function sessionRequiresAuth(): Promise<void> {
  return expectUnauthenticated('POST', SESSION_PATH, { trainerId: STARTER_ID });
}

function sessionDeletionRequiresAuth(): Promise<void> {
  return expectUnauthenticated('DELETE', SESSION_PATH);
}

function wsTicketRequiresAuth(): Promise<void> {
  return expectUnauthenticated('POST', WS_TICKET_PATH);
}

/**
 * The list of the species of the starter is public content: the answer does
 * not ask for a token.
 */
function startersArePublic(): Promise<void> {
  const deps = buildDependencies({ admin: buildEmptyAdmin() });
  const handler = buildHandler(deps);
  const request = buildRequest('GET', STARTERS_PATH, null);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(OK);
    return readJson(response).then(assertStarters);
  });
}

function assertStarters(body: unknown): void {
  expect(body).toEqual({ starters: [] });
}

/**
 * The ticket is issued for the account of the token, and it is of single use.
 */
function issuesTheTicketOfTheAccount(): Promise<void> {
  const deps = buildDependencies();
  const handler = buildHandler(deps);
  const request = buildRequest('POST', WS_TICKET_PATH, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(OK);
    return readJson(response).then(assertTicket);
  });
}

function assertTicket(body: unknown): void {
  const ticket = body as { expiresAt: number; ticket: string };
  expect(ticket.ticket).not.toBe('');
  expect(ticket.expiresAt).toBeGreaterThan(0);
}

/**
 * Deleting the session of the trainer disconnects the trainer of the account:
 * the state of the player is not served anymore.
 */
function sessionDeletionClearsTheTrainer(): Promise<void> {
  const deps = buildDependencies();
  deps.sessions.set(USER_ID, 'trainer-1');
  const handler = buildHandler(deps);
  const deletion = buildRequest('DELETE', SESSION_PATH, USER_TOKEN);
  return send(handler, deletion).then(function assertNoContent(response: Response): Promise<void> {
    expect(response.status).toBe(NO_CONTENT);
    const state = buildRequest('GET', PLAYER_STATE_PATH, USER_TOKEN);
    return send(handler, state).then(function assertStatus(stateResponse: Response): Promise<void> {
      expect(stateResponse.status).toBe(NOT_FOUND);
      return readError(stateResponse).then(assertTrainerNotFound);
    });
  });
}

/**
 * The channel of the account is closed with the trainer: a channel left open
 * would push the state of a session that does not exist anymore.
 */
function sessionDeletionClosesTheChannel(): Promise<void> {
  const deps = buildDependencies();
  deps.sessions.set(USER_ID, TRAINER_ID);
  const connection = registerFakeConnection(deps, USER_ID);
  const handler = buildHandler(deps);
  const deletion = buildRequest('DELETE', SESSION_PATH, USER_TOKEN);
  return send(handler, deletion).then(function assertClosed(response: Response): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(connection.closed?.code).toBe(1000);
    expect(connection.closed?.reason).toBe('trainer disconnected');
  });
}

/**
 * Entering with a trainer closes the channel the account had open: the
 * account has one session and one channel.
 */
function sessionOpeningClosesTheOlderChannel(): Promise<void> {
  const deps = buildDependencies({ admin: buildTrainerAdmin(TRAINER_ID, USER_ID) });
  const connection = registerFakeConnection(deps, USER_ID);
  const handler = buildHandler(deps);
  const opening = buildJsonRequest('POST', SESSION_PATH, { trainerId: TRAINER_ID }, USER_TOKEN);
  return send(handler, opening).then(function assertClosed(response: Response): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(connection.closed?.code).toBe(4001);
    expect(connection.closed?.reason).toBe('replaced by a newer connection');
  });
}

function playerStateRequiresAuth(): Promise<void> {
  return expectUnauthenticated('GET', PLAYER_STATE_PATH);
}

function abilitySlotsRequireAuth(): Promise<void> {
  return expectUnauthenticated(
    'PUT',
    '/api/creatures/11111111-1111-4111-8111-111111111111/ability-slots',
    {
      abilityIds: [],
    },
  );
}

function gearSlotRequiresAuth(): Promise<void> {
  return expectUnauthenticated('PUT', '/api/gear-slots/4', {
    itemId: '11111111-1111-4111-8111-111111111111',
  });
}

function gearSlotDeletionRequiresAuth(): Promise<void> {
  return expectUnauthenticated('DELETE', '/api/gear-slots/6');
}

function teamSwapRequiresAuth(): Promise<void> {
  return expectUnauthenticated('POST', '/api/team/swap', {
    creatureId: '11111111-1111-4111-8111-111111111111',
  });
}

function healthIsPublic(): Promise<void> {
  const handler = buildHandler();
  const request = buildRequest('GET', HEALTH_PATH, null);
  return send(handler, request).then(function assertHealth(response: Response): Promise<void> {
    expect(response.status).toBe(200);
    return readJson(response).then(assertHealthBody);
  });
}

function assertHealthBody(body: unknown): void {
  expect(body).toEqual({ status: 'ok' });
}

function playerStateWithoutSessionIsNotFound(): Promise<void> {
  const handler = buildHandler();
  const request = buildRequest('GET', PLAYER_STATE_PATH, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(404);
    return readError(response).then(assertTrainerNotFound);
  });
}

/**
 * The state of the account is still in the revision the client has: there is
 * nothing new to send.
 */
function playerStateWithTheSameRevisionHasNoContent(): Promise<void> {
  const deps = buildDependencies();
  deps.sessions.set(USER_ID, TRAINER_ID);
  const handler = buildHandler(deps);
  const request = buildRequest('GET', `${PLAYER_STATE_PATH}?sinceRev=0`, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): void {
    expect(response.status).toBe(NO_CONTENT);
  });
}

/**
 * The state of the account is newer than the revision the client has: the
 * whole state is sent.
 */
function playerStateWithAnOlderRevisionIsRead(): Promise<void> {
  const deps = buildDependencies({ admin: buildTrainerAdmin(TRAINER_ID, USER_ID) });
  deps.sessions.set(USER_ID, TRAINER_ID);
  deps.revs.next(USER_ID);
  const handler = buildHandler(deps);
  const request = buildRequest('GET', `${PLAYER_STATE_PATH}?sinceRev=0`, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(OK);
    return readJson(response).then(assertRevision);
  });
}

function assertRevision(body: unknown): void {
  const state = body as { epoch: string; rev: number; serverNow: number };
  expect(state.rev).toBe(1);
  expect(state.epoch).not.toBe('');
  expect(state.serverNow).toBeGreaterThan(0);
}

function assertTrainerNotFound(error: { error: string }): void {
  expect(error.error).toBe('trainer_not_found');
}

test('GET /api/trainers without bearer returns 401', trainerListRequiresAuth);
test('POST /api/trainers without bearer returns 401', trainerCreationRequiresAuth);
test('POST /api/session/trainer without bearer returns 401', sessionRequiresAuth);
test('DELETE /api/session/trainer without bearer returns 401', sessionDeletionRequiresAuth);
test('POST /api/ws-ticket without bearer returns 401', wsTicketRequiresAuth);
test('GET /api/starters is public', startersArePublic);
test('POST /api/ws-ticket issues the ticket of the account', issuesTheTicketOfTheAccount);
test(
  'DELETE /api/session/trainer disconnects the trainer of the account',
  sessionDeletionClearsTheTrainer,
);
test(
  'DELETE /api/session/trainer closes the channel of the account',
  sessionDeletionClosesTheChannel,
);
test(
  'POST /api/session/trainer closes the channel the account had open',
  sessionOpeningClosesTheOlderChannel,
);
test('GET /api/player/state without bearer returns 401', playerStateRequiresAuth);
test('PUT /api/creatures/:id/ability-slots without bearer returns 401', abilitySlotsRequireAuth);
test('PUT /api/gear-slots/:slot without bearer returns 401', gearSlotRequiresAuth);
test('DELETE /api/gear-slots/:slot without bearer returns 401', gearSlotDeletionRequiresAuth);
test('POST /api/team/swap without bearer returns 401', teamSwapRequiresAuth);
test('GET /api/health is public', healthIsPublic);
test(
  'GET /api/player/state without an active trainer returns 404',
  playerStateWithoutSessionIsNotFound,
);
test(
  'GET /api/player/state with the revision the client has returns 204',
  playerStateWithTheSameRevisionHasNoContent,
);
test(
  'GET /api/player/state with an older revision reads the state',
  playerStateWithAnOlderRevisionIsRead,
);
