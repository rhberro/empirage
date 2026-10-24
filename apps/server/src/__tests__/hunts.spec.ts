import { expect, test } from 'bun:test';

import type { HuntSession } from '@creatures/contracts/huntSession';
import type { HuntSnapshot } from '@creatures/contracts/huntSim';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ServerDependencies } from '~/dependencies';
import { HuntStartError } from '~/hunt/errors';
import type { HuntStartErrorCode } from '~/hunt/errors';
import { ensureHunt } from '~/hunt/runtime/ensure';

import {
  CONFLICT,
  CREATED,
  CURRENT_HUNT_PATH,
  HUNTS_PATH,
  NO_CONTENT,
  NOT_FOUND,
  OK,
  TRAINER_ID,
  UNAUTHORIZED,
  USER_ID,
  USER_TOKEN,
  buildDependencies,
  buildEmptyAdmin,
  buildHandler,
  buildHuntSnapshot,
  buildJsonRequest,
  buildNoopHuntManager,
  buildRequest,
  readError,
  readJson,
  send,
} from './support';

const HUNT_AREA_ID = '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01';
const FORBIDDEN = 403;
const BAD_REQUEST = 400;

function alwaysHas(): boolean {
  return true;
}

const SESSION_ROW = {
  account_id: USER_ID,
  actions: [],
  encounters: 0,
  end_reason: null,
  ended_at: null,
  hunt_area_id: HUNT_AREA_ID,
  id: 'session-1',
  kills: 0,
  last_simulated_at: '2026-10-23T12:00:00.000Z',
  rng_draws: 0,
  rng_seed: 1,
  simulation_state: null,
  stamina_at_start: 480,
  stamina_spent_minutes: 0,
  started_at: '2026-10-23T12:00:00.000Z',
  status: 'active',
  trainer_id: TRAINER_ID,
};

function startRequiresAuth(): Promise<void> {
  const handler = buildHandler(buildDependencies());
  const request = buildJsonRequest('POST', HUNTS_PATH, { huntAreaId: HUNT_AREA_ID }, null);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(UNAUTHORIZED);
    return readError(response).then(function assertCode(error: { error: string }): void {
      expect(error.error).toBe('unauthenticated');
    });
  });
}

function startsTheHunt(): Promise<void> {
  const started: { accountId: string; areaId: string; trainerId: string }[] = [];
  const snapshot = buildHuntSnapshot(3);
  const deps = buildDependencies({
    hunts: buildNoopHuntManager({
      start: function start(input: {
        accountId: string;
        areaId: string;
        trainerId: string;
      }): Promise<typeof snapshot> {
        started.push(input);
        return Promise.resolve(snapshot);
      },
    }),
  });
  addTrainerSession(deps);
  const handler = buildHandler(deps);
  const request = buildJsonRequest('POST', HUNTS_PATH, { huntAreaId: HUNT_AREA_ID }, USER_TOKEN);
  return send(handler, request).then(function assertBody(response: Response): Promise<void> {
    expect(response.status).toBe(CREATED);
    expect(started).toEqual([{ accountId: USER_ID, areaId: HUNT_AREA_ID, trainerId: TRAINER_ID }]);
    return readJson(response).then(function assertHunt(body: unknown): void {
      expect(body).toEqual({ hunt: snapshot });
    });
  });
}

function refusesAnInvalidBody(): Promise<void> {
  const deps = buildDependencies();
  addTrainerSession(deps);
  const handler = buildHandler(deps);
  const request = buildJsonRequest('POST', HUNTS_PATH, { huntAreaId: 'not-a-uuid' }, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(BAD_REQUEST);
    return readError(response).then(function assertCode(error: { error: string }): void {
      expect(error.error).toBe('invalid_hunt');
    });
  });
}

function refusesBelowTheLevel(): Promise<void> {
  return expectStartFailure('level_too_low', FORBIDDEN);
}

function refusesWithoutStamina(): Promise<void> {
  return expectStartFailure('stamina_insufficient', CONFLICT);
}

function refusesASecondHunt(): Promise<void> {
  return expectStartFailure('already_hunting', CONFLICT);
}

function refusesWithoutAViableCreature(): Promise<void> {
  return expectStartFailure('no_viable_creature', CONFLICT);
}

function expectStartFailure(code: HuntStartErrorCode, status: number): Promise<void> {
  const deps = buildDependencies({
    hunts: buildNoopHuntManager({
      start: function start(): Promise<never> {
        return Promise.reject(new HuntStartError(code));
      },
    }),
  });
  addTrainerSession(deps);
  const handler = buildHandler(deps);
  const request = buildJsonRequest('POST', HUNTS_PATH, { huntAreaId: HUNT_AREA_ID }, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(status);
    return readError(response).then(function assertCode(error: {
      error: string;
      message: string;
    }): void {
      expect(error.error).toBe(code);
      expect(error.message).not.toBe('');
    });
  });
}

function readsTheCurrentHunt(): Promise<void> {
  const huntSnapshot = buildHuntSnapshot(7);
  const deps = buildDependencies({
    hunts: buildNoopHuntManager({
      snapshot: function snapshot(): Promise<HuntSnapshot> {
        return Promise.resolve(huntSnapshot);
      },
    }),
  });
  addTrainerSession(deps);
  const handler = buildHandler(deps);
  const request = buildRequest('GET', CURRENT_HUNT_PATH, USER_TOKEN);
  return send(handler, request).then(function assertBody(response: Response): Promise<void> {
    expect(response.status).toBe(OK);
    return readJson(response).then(function assertHunt(body: unknown): void {
      expect(body).toEqual({ hunt: huntSnapshot });
    });
  });
}

function answersNotFoundWithoutAHunt(): Promise<void> {
  const deps = buildDependencies({ admin: buildEmptyAdmin() });
  addTrainerSession(deps);
  const handler = buildHandler(deps);
  const request = buildRequest('GET', CURRENT_HUNT_PATH, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(NOT_FOUND);
    return readError(response).then(function assertCode(error: { error: string }): void {
      expect(error.error).toBe('hunt_not_found');
    });
  });
}

function deletesTheCurrentHunt(): Promise<void> {
  const finalized: string[] = [];
  const deps = buildDependencies({
    hunts: buildNoopHuntManager({
      finalize: function finalize(trainerId: string): Promise<void> {
        finalized.push(trainerId);
        return Promise.resolve();
      },
      has: alwaysHas,
      snapshot: readsAHuntSnapshot,
    }),
  });
  addTrainerSession(deps);
  const handler = buildHandler(deps);
  const request = buildRequest('DELETE', CURRENT_HUNT_PATH, USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(finalized).toEqual([TRAINER_ID]);
  });
}

/**
 * A session that is open in the database but not in memory is resumed by
 * `ensureHunt` before the snapshot is read.
 */
function hydratesTheOpenSession(): Promise<void> {
  const huntSnapshot = buildHuntSnapshot(9);
  let hydrated: HuntSession | null = null;
  let resumed = false;
  const deps = buildDependencies({
    admin: buildSessionAdmin(),
    hunts: buildNoopHuntManager({
      hydrate: function hydrate(session: HuntSession): Promise<void> {
        hydrated = session;
        resumed = true;
        return Promise.resolve();
      },
      snapshot: function snapshot(): Promise<HuntSnapshot | null> {
        return Promise.resolve(resumed ? huntSnapshot : null);
      },
    }),
  });
  return ensureHunt(deps, TRAINER_ID).then(function assertSnapshot(
    result: HuntSnapshot | null,
  ): void {
    expect(result).toEqual(huntSnapshot);
    expect(hydrated?.id).toBe('session-1');
    expect(hydrated?.trainerId).toBe(TRAINER_ID);
  });
}

function addTrainerSession(deps: ServerDependencies): void {
  deps.sessions.set(USER_ID, TRAINER_ID);
}

function readsAHuntSnapshot(): Promise<HuntSnapshot | null> {
  return Promise.resolve(buildHuntSnapshot(1));
}

/**
 * A client whose only table is an open session of the trainer.
 */
function buildSessionAdmin(): SupabaseClient {
  const answer = Promise.resolve({ data: SESSION_ROW, error: null });
  const query = {
    eq: function eq(): unknown {
      return query;
    },
    maybeSingle: function maybeSingle(): Promise<unknown> {
      return answer;
    },
    order: function order(): unknown {
      return query;
    },
    select: function select(): unknown {
      return query;
    },
  };
  return {
    from: function from(): unknown {
      return query;
    },
  } as unknown as SupabaseClient;
}

test('POST /api/hunts without bearer returns 401', startRequiresAuth);
test('POST /api/hunts starts the hunt and answers 201', startsTheHunt);
test('POST /api/hunts refuses an invalid body with 400', refusesAnInvalidBody);
test('POST /api/hunts refuses a low level with 403', refusesBelowTheLevel);
test('POST /api/hunts refuses the lack of stamina with 409', refusesWithoutStamina);
test('POST /api/hunts refuses a second hunt with 409', refusesASecondHunt);
test('POST /api/hunts refuses an unviable team with 409', refusesWithoutAViableCreature);
test('GET /api/hunts/current answers the hunt', readsTheCurrentHunt);
test('GET /api/hunts/current without a hunt returns 404', answersNotFoundWithoutAHunt);
test('DELETE /api/hunts/current finalizes the hunt', deletesTheCurrentHunt);
test('ensureHunt hydrates the session that is not in memory', hydratesTheOpenSession);
