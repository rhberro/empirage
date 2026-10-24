import { expect, test } from 'bun:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import { mapTeamOperationError } from '~/db/errors';

import {
  CONFLICT,
  NO_CONTENT,
  TRAINER_ID,
  USER_ID,
  USER_TOKEN,
  buildDependencies,
  buildHandler,
  buildRecordingBroadcaster,
  buildRequest,
  readError,
  send,
} from './support';
import type { BroadcastRecorder } from './support';

const CREATURE_ID = '44444444-4444-4444-8444-444444444444';
const CREATURE_PATH = `/api/creatures/${CREATURE_ID}`;
const TEAM_MEMBER_PATH = `/api/team/${CREATURE_ID}`;

type RpcAnswer = {
  data: boolean | null;
  error: { code: string; message: string } | null;
};

type Setup = {
  deps: ReturnType<typeof buildDependencies>;
  recorder: BroadcastRecorder;
};

function buildSetup(answer: RpcAnswer): Setup {
  const recorder = buildRecordingBroadcaster();
  const deps = buildDependencies({
    admin: buildRpcAdmin(answer),
    broadcaster: recorder.broadcaster,
  });
  deps.sessions.set(USER_ID, TRAINER_ID);
  return { deps, recorder };
}

function buildRpcAdmin(answer: RpcAnswer): SupabaseClient {
  return {
    rpc: function rpc(): Promise<RpcAnswer> {
      return Promise.resolve(answer);
    },
  } as unknown as SupabaseClient;
}

function buildRefusal(message: string): RpcAnswer {
  return { data: null, error: { code: 'P0001', message } };
}

function releaseIsRefusedWhenItIsTheLastCreature(): Promise<void> {
  const setup = buildSetup(buildRefusal('last_creature'));
  const request = buildRequest('DELETE', CREATURE_PATH, USER_TOKEN);
  return send(buildHandler(setup.deps), request).then(function assertRefusal(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(CONFLICT);
    expect(setup.recorder.pushes).toHaveLength(0);
    return readError(response).then(function assertCode(error: { error: string }): void {
      expect(error.error).toBe('last_creature');
    });
  });
}

function removalIsRefusedWhenItIsTheLastMember(): Promise<void> {
  const setup = buildSetup(buildRefusal('last_team_member'));
  const request = buildRequest('DELETE', TEAM_MEMBER_PATH, USER_TOKEN);
  return send(buildHandler(setup.deps), request).then(function assertRefusal(
    response: Response,
  ): Promise<void> {
    expect(response.status).toBe(CONFLICT);
    expect(setup.recorder.pushes).toHaveLength(0);
    return readError(response).then(function assertCode(error: { error: string }): void {
      expect(error.error).toBe('last_team_member');
    });
  });
}

function releaseSucceedsWhenAnotherCreatureRemains(): Promise<void> {
  const setup = buildSetup({ data: true, error: null });
  const request = buildRequest('DELETE', CREATURE_PATH, USER_TOKEN);
  return send(buildHandler(setup.deps), request).then(function assertStatus(
    response: Response,
  ): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(setup.recorder.pushes).toHaveLength(1);
  });
}

function removalSucceedsWhenTheTeamHasAnotherMember(): Promise<void> {
  const setup = buildSetup({ data: true, error: null });
  const request = buildRequest('DELETE', TEAM_MEMBER_PATH, USER_TOKEN);
  return send(buildHandler(setup.deps), request).then(function assertStatus(
    response: Response,
  ): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(setup.recorder.pushes).toHaveLength(1);
  });
}

function mapsTheLastCreatureToConflict(): void {
  const mapped = mapTeamOperationError({ code: 'P0001', message: 'last_creature' });
  expect(mapped.status).toBe(CONFLICT);
  expect(mapped.code).toBe('last_creature');
  expect(mapped.message).toBe('O treinador precisa ter pelo menos uma criatura.');
}

function mapsTheLastTeamMemberToConflict(): void {
  const mapped = mapTeamOperationError({ code: 'P0001', message: 'last_team_member' });
  expect(mapped.status).toBe(CONFLICT);
  expect(mapped.code).toBe('last_team_member');
  expect(mapped.message).toBe('O time não pode ficar vazio.');
}

test('releasing the last creature is refused with 409', releaseIsRefusedWhenItIsTheLastCreature);
test('removing the last team member is refused with 409', removalIsRefusedWhenItIsTheLastMember);
test(
  'releasing a creature with another one left is accepted',
  releaseSucceedsWhenAnotherCreatureRemains,
);
test(
  'removing a creature with another one in the team is accepted',
  removalSucceedsWhenTheTeamHasAnotherMember,
);
test('last_creature maps to a conflict', mapsTheLastCreatureToConflict);
test('last_team_member maps to a conflict', mapsTheLastTeamMemberToConflict);
