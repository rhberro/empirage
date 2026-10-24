import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { CONFLICT, NO_CONTENT, SESSION_PATH, TEAM_PATH } from '~/__tests__/support';

import {
  buildTestName,
  buildTrainerBody,
  cleanupEnvironment,
  createCreature,
  prepareEnvironment,
  readToken,
} from './environment';
import type { IntegrationEnvironment, TrainerPayload } from './environment';
import { sendJson, sendRequest } from './teamSupport';

const ENABLED = globalThis.process.env.CREATURES_TEST_DB === '1';
const OTHER_SPECIES_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const CAPTURED_AT = ['2026-02-01T00:00:00.000Z', '2026-02-02T00:00:00.000Z'];

let env: IntegrationEnvironment;
let trainerId = '';
let starterCreatureId = '';
let token = '';

describe.skipIf(!ENABLED)('the last creature guard against the real database', describeGuard);

function describeGuard(): void {
  beforeAll(prepareSuite);
  afterAll(cleanupSuite);

  test('the only creature of the trainer cannot be released', refusesTheOnlyRelease);
  test('the only member of the team cannot be removed', refusesTheOnlyRemoval);
  test('the only team member cannot be released even with storage', refusesTheOnlyTeamRelease);
  test('a creature with others left can be released', releasesANonLastTeamCreature);
  test('a creature with another member can leave the team', removesOneOfTwo);
}

function prepareSuite(): Promise<void> {
  return prepareEnvironment()
    .then(function store(environment: IntegrationEnvironment): Promise<void> {
      env = environment;
      return readToken(env, env.ownerEmail).then(function keepToken(accessToken: string): void {
        token = accessToken;
      });
    })
    .then(createTrainer)
    .then(readStarterCreature);
}

function cleanupSuite(): Promise<unknown> {
  if (env === undefined) {
    return Promise.resolve();
  }
  return cleanupEnvironment(env);
}

function createTrainer(): Promise<void> {
  return sendJson(env, 'POST', '/api/trainers', buildTrainerBody(buildTestName()), token).then(
    function readTrainer(response: Response): Promise<void> {
      return response.json().then(function keepTrainer(body: unknown): Promise<void> {
        const trainer = body as TrainerPayload;
        trainerId = trainer.id;
        return sendJson(env, 'POST', SESSION_PATH, { trainerId }, token).then(
          function selected(): void {
            expect(true).toBe(true);
          },
        );
      });
    },
  );
}

function readStarterCreature(): Promise<void> {
  const query = env.admin.from('creatures').select('id').eq('trainer_id', trainerId);
  return Promise.resolve(query).then(function keep(result: {
    data: { id: string }[] | null;
    error: { message: string } | null;
  }): void {
    const [first] = result.data ?? [];
    if (first === undefined) {
      throw new Error(`the starter creature is missing: ${result.error?.message ?? 'no rows'}`);
    }
    starterCreatureId = first.id;
  });
}

function refusesTheOnlyRelease(): Promise<void> {
  return expectRefusal('DELETE', `/api/creatures/${starterCreatureId}`, 'last_creature');
}

function refusesTheOnlyRemoval(): Promise<void> {
  return expectRefusal('DELETE', `${TEAM_PATH}/${starterCreatureId}`, 'last_team_member');
}

function refusesTheOnlyTeamRelease(): Promise<void> {
  return createStoredCreature(0).then(function release(): Promise<void> {
    return expectRefusal('DELETE', `/api/creatures/${starterCreatureId}`, 'last_creature');
  });
}

function releasesANonLastTeamCreature(): Promise<void> {
  return readStorageId().then(function addFirst(first: string): Promise<void> {
    return sendJson(env, 'POST', TEAM_PATH, { creatureId: first }, token).then(function readStatus(
      response: Response,
    ): Promise<void> {
      expect(response.status).toBe(NO_CONTENT);
      return sendRequest(env, 'DELETE', `/api/creatures/${first}`, token).then(
        function assertRelease(release: Response): Promise<void> {
          expect(release.status).toBe(NO_CONTENT);
          return readTeamIds().then(function assertTeam(remaining: string[]): void {
            expect(remaining).toHaveLength(1);
            expect(remaining).not.toContain(first);
          });
        },
      );
    });
  });
}

function removesOneOfTwo(): Promise<void> {
  return createStoredCreature(1).then(function addSecond(creatureId: string): Promise<void> {
    return sendJson(env, 'POST', TEAM_PATH, { creatureId }, token).then(function readStatus(
      response: Response,
    ): Promise<void> {
      expect(response.status).toBe(NO_CONTENT);
      return sendRequest(env, 'DELETE', `${TEAM_PATH}/${creatureId}`, token).then(
        function assertStatus(removal: Response): Promise<void> {
          expect(removal.status).toBe(NO_CONTENT);
          return readTeamIds().then(function assertTeam(remaining: string[]): void {
            expect(remaining).toHaveLength(1);
            expect(remaining).not.toContain(creatureId);
          });
        },
      );
    });
  });
}

function expectRefusal(method: string, path: string, code: string): Promise<void> {
  return sendRequest(env, method, path, token).then(function assertStatus(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(CONFLICT);
    return response.json().then(function assertCode(body: unknown): void {
      expect((body as { error: string }).error).toBe(code);
    });
  });
}

function createStoredCreature(index: number): Promise<string> {
  const capturedAt = CAPTURED_AT[index];
  if (capturedAt === undefined) {
    throw new Error('the captured creature index is out of range');
  }
  return createCreature(env, trainerId, OTHER_SPECIES_ID, capturedAt);
}

function readStorageId(): Promise<string> {
  const query = env.admin
    .from('creatures')
    .select('id')
    .eq('trainer_id', trainerId)
    .eq('is_in_team', false);
  return Promise.resolve(query).then(function read(result: {
    data: { id: string }[] | null;
  }): string {
    const [first] = result.data ?? [];
    if (first === undefined) {
      throw new Error('the captured creature is missing');
    }
    return first.id;
  });
}

function readTeamIds(): Promise<string[]> {
  const query = env.admin
    .from('creatures')
    .select('id, team_slot')
    .eq('trainer_id', trainerId)
    .eq('is_in_team', true)
    .order('team_slot', { ascending: true });
  return Promise.resolve(query).then(function read(result: {
    data: { id: string }[] | null;
  }): string[] {
    return (result.data ?? []).map(function readId(row: { id: string }): string {
      return row.id;
    });
  });
}
